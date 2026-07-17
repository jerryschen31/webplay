import { MockAdapter } from "@webplay/adapters";
import { describe, expect, it } from "vitest";
import { runBench, toCsv } from "../src/benchlib.js";

describe("runBench", () => {
  it("records successes with latency and cost", async () => {
    const summary = await runBench(new MockAdapter(), {
      runs: 3,
      params: { genre: "lofi", durationSec: 1, instrumental: true },
    });
    expect(summary.provider).toBe("mock");
    expect(summary.succeeded).toBe(3);
    expect(summary.failureRate).toBe(0);
    expect(summary.totalCostUSD).toBe(0);
    expect(summary.minMs).not.toBeNull();
    expect(summary.results.every((r) => r.ok && r.file)).toBe(true);
  });

  it("keeps going after failures and reports the failure rate", async () => {
    const flaky = new MockAdapter({ failNextN: 2 });
    const seen: number[] = [];
    const summary = await runBench(flaky, {
      runs: 4,
      params: { genre: "lofi", durationSec: 1, instrumental: true },
      onRun: (r) => seen.push(r.run),
    });
    expect(summary.succeeded).toBe(2);
    expect(summary.failureRate).toBe(0.5);
    expect(summary.results[0]?.error).toMatch(/forced failure/);
    expect(seen).toEqual([1, 2, 3, 4]);
  });
});

describe("toCsv", () => {
  it("escapes embedded quotes per RFC 4180 and flattens newlines", () => {
    const csv = toCsv({
      provider: "mock",
      runs: 1,
      succeeded: 0,
      failureRate: 1,
      minMs: null,
      meanMs: null,
      maxMs: null,
      totalCostUSD: 0,
      results: [
        {
          run: 1,
          ok: false,
          elapsedMs: 5,
          error: 'HTTP 402 {"detail":"paid_plan_required"}\nsecond line',
        },
      ],
    });
    const row = csv.split("\n")[1];
    expect(row).toContain(
      '"HTTP 402 {""detail"":""paid_plan_required""} second line"',
    );
    expect(row).not.toContain("\nsecond");
  });

  it("emits one quoted row per run with errors flattened", async () => {
    const summary = await runBench(new MockAdapter({ failNextN: 1 }), {
      runs: 2,
      params: { genre: "lofi", durationSec: 1, instrumental: true },
    });
    const csv = toCsv(summary);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("run,ok,elapsed_ms,file,error");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"false"');
    expect(lines[2]).toContain('"true"');
  });
});
