import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runBench, toCsv } from "./benchlib.js";
import { type AdapterName, getAdapter, KNOWN_ADAPTERS } from "./registry.js";

async function main(): Promise<void> {
  const rootEnv = resolve(import.meta.dirname, "../../../.env");
  if (existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      provider: { type: "string", short: "p" },
      runs: { type: "string", short: "n" },
      genre: { type: "string", short: "g" },
      duration: { type: "string", short: "d" },
      out: { type: "string", short: "o" },
    },
  });

  const provider = (values.provider ?? "mock") as AdapterName;
  if (!KNOWN_ADAPTERS.includes(provider)) {
    console.error(
      `unknown provider "${provider}". known: ${KNOWN_ADAPTERS.join(", ")}`,
    );
    process.exit(2);
  }
  const runs = Number(values.runs ?? "3");
  const duration = Number(values.duration ?? "30");
  if (
    !Number.isInteger(runs) ||
    runs < 1 ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    console.error(
      `invalid --runs (${values.runs}) or --duration (${values.duration})`,
    );
    process.exit(2);
  }

  const adapter = getAdapter(provider);
  if (!(await adapter.isHealthy())) {
    console.error(
      `adapter "${adapter.name}" is unhealthy — check credentials/setup before benching`,
    );
    process.exit(1);
  }

  console.error(
    `[bench] provider=${provider} runs=${runs} duration=${duration}s`,
  );
  const summary = await runBench(adapter, {
    runs,
    params: {
      genre: values.genre ?? "lofi",
      durationSec: duration,
      instrumental: true,
    },
    onRun: (r) =>
      console.error(
        `[bench] run ${r.run}/${runs}: ${r.ok ? "ok" : "FAIL"} in ${r.elapsedMs}ms${r.error ? ` — ${r.error.slice(0, 200)}` : ""}`,
      ),
  });

  const outDir =
    values.out ?? resolve(import.meta.dirname, "../../../bench-results");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  const base = join(outDir, `${provider}-${stamp}`);
  await writeFile(`${base}.json`, JSON.stringify(summary, null, 2));
  await writeFile(`${base}.csv`, toCsv(summary));

  console.log(
    JSON.stringify(
      {
        ...summary,
        results: undefined,
        files: [`${base}.json`, `${base}.csv`],
      },
      null,
      2,
    ),
  );
  process.exit(summary.succeeded === summary.runs ? 0 : 1);
}

main().catch((err) => {
  console.error("[bench] failed:", err);
  process.exit(1);
});
