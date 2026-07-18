import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { type AdapterName, getAdapter, KNOWN_ADAPTERS } from "./registry.js";

interface CliArgs {
  provider: AdapterName;
  genre: string;
  duration: number;
  out: string;
  mood?: string;
  seed?: string;
}

function parseCliArgs(argv: string[]): CliArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      provider: { type: "string", short: "p" },
      genre: { type: "string", short: "g" },
      duration: { type: "string", short: "d" },
      out: { type: "string", short: "o" },
      mood: { type: "string", short: "m" },
      seed: { type: "string", short: "s" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const provider = values.provider ?? "mock";
  if (!KNOWN_ADAPTERS.includes(provider as AdapterName)) {
    console.error(
      `unknown provider "${provider}". known: ${KNOWN_ADAPTERS.join(", ")}`,
    );
    process.exit(2);
  }

  const genre = values.genre ?? "lofi";
  const duration = Number(values.duration ?? "30");
  if (!Number.isFinite(duration) || duration <= 0) {
    console.error(`invalid --duration: ${values.duration}`);
    process.exit(2);
  }

  return {
    provider: provider as AdapterName,
    genre,
    duration,
    out: values.out ?? "./out",
    mood: values.mood,
    seed: values.seed,
  };
}

function printHelp(): void {
  console.log(`webplay generator CLI

usage:
  pnpm generate --provider=<name> --genre=<genre> --duration=<sec> [--mood=<mood>] [--seed=<n>] [--out=<dir>]

options:
  -p, --provider   adapter name (default: mock). known: ${KNOWN_ADAPTERS.join(", ")}
  -g, --genre      target genre (default: lofi)
  -d, --duration   duration in seconds (default: 30)
  -m, --mood       optional mood tag
  -s, --seed       fixed RNG seed for reproducible renders
  -o, --out        output directory (default: ./out)
  -h, --help       show this help`);
}

async function main(): Promise<void> {
  // provider credentials live in the repo-root .env for local runs
  const rootEnv = resolve(import.meta.dirname, "../../../.env");
  if (existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }

  const args = parseCliArgs(process.argv.slice(2));
  const adapter = getAdapter(args.provider);

  if (!(await adapter.isHealthy())) {
    console.error(`adapter "${adapter.name}" reports unhealthy; aborting`);
    process.exit(1);
  }

  console.log(
    `[generator] provider=${adapter.name} genre=${args.genre} duration=${args.duration}s`,
  );
  const startedAt = Date.now();
  const track = await adapter.generateTrack({
    genre: args.genre,
    durationSec: args.duration,
    mood: args.mood,
    seed: args.seed,
    instrumental: true,
  });
  const elapsedMs = Date.now() - startedAt;

  await mkdir(args.out, { recursive: true });
  const dest = resolve(
    args.out,
    `${track.providerId}-${track.providerTrackId}.${track.format}`,
  );
  await copyFile(track.audioUrl, dest);

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: track.providerId,
        trackId: track.providerTrackId,
        file: dest,
        format: track.format,
        durationSec: track.durationSec,
        license: track.licenseTerms,
        elapsedMs,
        cost_usd: adapter.costPerTrackUSD,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[generator] failed:", err);
  process.exit(1);
});
