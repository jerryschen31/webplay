import type { AudioAdapter, GenerateTrackParams } from "@webplay/adapters";

export interface BenchRun {
  run: number;
  ok: boolean;
  elapsedMs: number;
  file?: string;
  error?: string;
}

export interface BenchSummary {
  provider: string;
  runs: number;
  succeeded: number;
  failureRate: number;
  minMs: number | null;
  meanMs: number | null;
  maxMs: number | null;
  totalCostUSD: number;
  results: BenchRun[];
}

export interface BenchOptions {
  runs: number;
  params: GenerateTrackParams;
  /** Called after each run; lets the CLI stream progress. */
  onRun?: (run: BenchRun) => void;
  now?: () => number;
}

/**
 * Sequentially exercise one adapter N times, recording latency and
 * failures — the Feature 2 robustness protocol (notes/phase0-feature2.md
 * §6). Sequential on purpose: local models saturate the machine and
 * commercial APIs rate-limit; parallelism would distort both.
 */
export async function runBench(
  adapter: AudioAdapter,
  options: BenchOptions,
): Promise<BenchSummary> {
  const now = options.now ?? Date.now;
  const results: BenchRun[] = [];

  for (let i = 1; i <= options.runs; i++) {
    const startedAt = now();
    let entry: BenchRun;
    try {
      const track = await adapter.generateTrack(options.params);
      entry = {
        run: i,
        ok: true,
        elapsedMs: now() - startedAt,
        file: track.audioUrl,
      };
    } catch (err) {
      entry = {
        run: i,
        ok: false,
        elapsedMs: now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    results.push(entry);
    options.onRun?.(entry);
  }

  const okTimes = results.filter((r) => r.ok).map((r) => r.elapsedMs);
  const succeeded = okTimes.length;
  return {
    provider: adapter.name,
    runs: options.runs,
    succeeded,
    failureRate: (options.runs - succeeded) / options.runs,
    minMs: succeeded ? Math.min(...okTimes) : null,
    meanMs: succeeded
      ? Math.round(okTimes.reduce((a, b) => a + b, 0) / succeeded)
      : null,
    maxMs: succeeded ? Math.max(...okTimes) : null,
    totalCostUSD: succeeded * adapter.costPerTrackUSD,
    results,
  };
}

export function toCsv(summary: BenchSummary): string {
  const header = "run,ok,elapsed_ms,file,error";
  const rows = summary.results.map((r) =>
    [
      r.run,
      r.ok,
      r.elapsedMs,
      r.file ?? "",
      (r.error ?? "").replaceAll("\n", " "),
    ]
      // RFC 4180: quote fields, escape embedded quotes by doubling
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header, ...rows].join("\n");
}
