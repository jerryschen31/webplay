import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry, retryDelayMs } from "../src/http.js";

const noSleep = () => Promise.resolve();

function jsonResponse(status: number, headers: Record<string, string> = {}) {
  return new Response(status === 204 ? null : "{}", { status, headers });
}

describe("retryDelayMs", () => {
  it("honors a numeric Retry-After header", () => {
    expect(retryDelayMs(0, "2", 500, 8000)).toBe(2000);
  });

  it("caps Retry-After at maxDelayMs", () => {
    expect(retryDelayMs(0, "60", 500, 8000)).toBe(8000);
  });

  it("backs off exponentially with jitter within bounds", () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const delay = retryDelayMs(attempt, null, 500, 8000);
      const ceiling = Math.min(500 * 2 ** attempt, 8000);
      expect(delay).toBeGreaterThanOrEqual(ceiling * 0.5);
      expect(delay).toBeLessThanOrEqual(ceiling);
    }
  });
});

describe("fetchWithRetry", () => {
  it("returns immediately on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200));
    const res = await fetchWithRetry(
      "https://x.test/",
      {},
      { fetchImpl, sleep: noSleep },
    );
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 429 then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { "retry-after": "0" }))
      .mockResolvedValueOnce(jsonResponse(200));
    const res = await fetchWithRetry(
      "https://x.test/",
      {},
      { fetchImpl, sleep: noSleep },
    );
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries 5xx up to the attempt budget then returns the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503));
    const res = await fetchWithRetry(
      "https://x.test/",
      {},
      { fetchImpl, sleep: noSleep, attempts: 3 },
    );
    expect(res.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable 4xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422));
    const res = await fetchWithRetry(
      "https://x.test/",
      {},
      { fetchImpl, sleep: noSleep },
    );
    expect(res.status).toBe(422);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries network errors and throws after exhausting attempts", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      fetchWithRetry(
        "https://x.test/",
        {},
        { fetchImpl, sleep: noSleep, attempts: 2 },
      ),
    ).rejects.toThrow(/failed after 2 attempts/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("fetchWithRetry hardening", () => {
  it("clamps a non-positive attempts option to one real request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200));
    const res = await fetchWithRetry(
      "https://x.test/",
      {},
      { fetchImpl, sleep: noSleep, attempts: 0 },
    );
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the caller's signal aborted", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockImplementation(async () => {
      controller.abort(new Error("user cancelled"));
      throw new Error("aborted mid-flight");
    });
    await expect(
      fetchWithRetry(
        "https://x.test/",
        { signal: controller.signal },
        { fetchImpl, sleep: noSleep, attempts: 4 },
      ),
    ).rejects.toThrow(/aborted mid-flight/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("forwards the caller's signal to fetch", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(init?.signal?.aborted).toBe(false);
        return jsonResponse(200);
      },
    ) as unknown as typeof fetch;
    await fetchWithRetry(
      "https://x.test/",
      { signal: controller.signal },
      { fetchImpl, sleep: noSleep },
    );
  });

  it("cancels an unconsumed retryable response body before retrying", async () => {
    const retryable = jsonResponse(503);
    const cancelSpy = vi.spyOn(retryable.body as ReadableStream, "cancel");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(retryable)
      .mockResolvedValueOnce(jsonResponse(200));
    const res = await fetchWithRetry(
      "https://x.test/",
      {},
      { fetchImpl, sleep: noSleep },
    );
    expect(res.status).toBe(200);
    expect(cancelSpy).toHaveBeenCalled();
  });
});
