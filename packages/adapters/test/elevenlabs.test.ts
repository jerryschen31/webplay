import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { ElevenLabsMusicAdapter } from "../src/elevenlabs.js";
import { AdapterError } from "../src/types.js";

const FAKE_MP3 = Buffer.from("ID3fake-mp3-bytes");

function adapterWith(fetchImpl: typeof fetch) {
  return new ElevenLabsMusicAdapter({
    apiKey: "test-key",
    retry: { fetchImpl, sleep: () => Promise.resolve() },
  });
}

describe("ElevenLabsMusicAdapter", () => {
  it("throws a clear AdapterError when the API key is missing", () => {
    const saved = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    try {
      expect(() => new ElevenLabsMusicAdapter()).toThrow(AdapterError);
      expect(() => new ElevenLabsMusicAdapter()).toThrow(/ELEVENLABS_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.ELEVENLABS_API_KEY = saved;
    }
  });

  it("generates a track and writes the mp3 to a temp file", async () => {
    const fetchImpl = vi.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        expect(String(url)).toContain("/v1/music?output_format=mp3_44100_128");
        const body = JSON.parse(String(init?.body));
        expect(body.prompt).toContain("lofi");
        expect(body.prompt).toContain("instrumental");
        expect(body.music_length_ms).toBe(180_000);
        expect(body.force_instrumental).toBe(true);
        const headers = (init?.headers ?? {}) as Record<string, string>;
        expect(headers["xi-api-key"]).toBe("test-key");
        return new Response(FAKE_MP3, {
          status: 200,
          headers: { "request-id": "req-123" },
        });
      },
    ) as unknown as typeof fetch;

    const track = await adapterWith(fetchImpl).generateTrack({
      genre: "lofi",
      durationSec: 180,
      mood: "calm",
      instrumental: true,
    });

    expect(track.providerId).toBe("elevenlabs");
    expect(track.providerTrackId).toBe("req-123");
    expect(track.format).toBe("mp3");
    expect(track.durationSec).toBe(180);
    expect(track.licenseTerms).toBe("commercial-paid");
    const written = await readFile(track.audioUrl);
    expect(written.equals(FAKE_MP3)).toBe(true);
  });

  it("clamps duration to the API minimum of 3s", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        expect(JSON.parse(String(init?.body)).music_length_ms).toBe(3000);
        return new Response(FAKE_MP3, { status: 200 });
      },
    ) as unknown as typeof fetch;

    await adapterWith(fetchImpl).generateTrack({
      genre: "lofi",
      durationSec: 1,
      instrumental: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("surfaces HTTP errors as AdapterError with response detail", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "quota exceeded" }), {
          status: 422,
        }),
    ) as unknown as typeof fetch;

    await expect(
      adapterWith(fetchImpl).generateTrack({
        genre: "lofi",
        durationSec: 60,
        instrumental: true,
      }),
    ).rejects.toThrow(/HTTP 422.*quota exceeded/);
  });

  it("retries a 429 before succeeding", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("busy", { status: 429, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(
        new Response(FAKE_MP3, { status: 200 }),
      ) as unknown as typeof fetch;

    const track = await adapterWith(fetchImpl).generateTrack({
      genre: "jazz",
      durationSec: 30,
      instrumental: true,
    });
    expect(track.format).toBe("mp3");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty audio body", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(new ArrayBuffer(0), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(
      adapterWith(fetchImpl).generateTrack({
        genre: "lofi",
        durationSec: 30,
        instrumental: true,
      }),
    ).rejects.toThrow(/empty body/);
  });

  it("isHealthy reflects /v1/user status", async () => {
    const ok = vi.fn(
      async () => new Response("{}", { status: 200 }),
    ) as unknown as typeof fetch;
    const bad = vi.fn(
      async () => new Response("no", { status: 401 }),
    ) as unknown as typeof fetch;
    expect(await adapterWith(ok).isHealthy()).toBe(true);
    expect(await adapterWith(bad).isHealthy()).toBe(false);
  });
});
