import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AdapterError,
  type AudioAdapter,
  type AudioFormat,
  type GeneratedTrack,
  type GenerateTrackParams,
  type LicenseTerms,
} from "./types.js";

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ProcessRunner = (
  command: string,
  args: string[],
  options: { timeoutMs: number },
) => Promise<ProcessResult>;

/** Spawn without a shell (argv only) and capture output. */
export const spawnRunner: ProcessRunner = (command, args, { timeoutMs }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });

/** JSON contract every generator script prints as its final stdout line. */
export interface LocalScriptResult {
  file: string;
  durationSec: number;
  sampleRate?: number;
  model?: string;
  [key: string]: unknown;
}

export interface LocalPythonAdapterConfig {
  name: string;
  /** Absolute path to the generator script. */
  scriptPath: string;
  licenseTerms: LicenseTerms;
  /** argv inserted between `uv` and the script path (e.g. run --project X python). */
  uvArgs?: string[];
  /** Extra script argv derived from adapter-specific settings. */
  extraArgs?: string[];
  /**
   * Per-call musical argv (key/BPM/steps/guidance) derived from the request.
   * Model-specific — only adapters whose script parses these flags set it, so
   * other models never receive flags they can't handle.
   */
  musicalArgs?: (params: GenerateTrackParams) => string[];
  /** Model inference is slow; default 30 min per track. */
  timeoutMs?: number;
  format?: AudioFormat;
  runner?: ProcessRunner;
  uvBinary?: string;
}

/**
 * LocalPythonAdapter — runs a Python generator script through `uv` as a
 * subprocess. The script owns model loading/inference and prints a single
 * JSON line (LocalScriptResult) as its last stdout line; audio lands in a
 * temp dir we create. Zero marginal cost: the M4 does the work.
 */
export class LocalPythonAdapter implements AudioAdapter {
  readonly name: string;
  readonly costPerTrackUSD = 0;

  private readonly config: Required<
    Pick<LocalPythonAdapterConfig, "timeoutMs" | "format" | "uvBinary">
  > &
    LocalPythonAdapterConfig;
  private readonly runner: ProcessRunner;

  constructor(config: LocalPythonAdapterConfig) {
    this.name = config.name;
    this.config = {
      timeoutMs: 30 * 60 * 1000,
      format: "wav",
      uvBinary: "uv",
      ...config,
    };
    this.runner = config.runner ?? spawnRunner;
  }

  /**
   * Cheap preflight: uv is installed and the script exists. Model weights
   * download lazily on first generation, so they are not checked here.
   */
  async isHealthy(): Promise<boolean> {
    if (!existsSync(this.config.scriptPath)) {
      return false;
    }
    try {
      const res = await this.runner(this.config.uvBinary, ["--version"], {
        timeoutMs: 15_000,
      });
      return res.exitCode === 0;
    } catch {
      return false;
    }
  }

  async generateTrack(params: GenerateTrackParams): Promise<GeneratedTrack> {
    const outDir = await mkdtemp(join(tmpdir(), `webplay-${this.name}-`));
    const prompt = params.prompt ?? buildLocalPrompt(params);
    const args = [
      ...(this.config.uvArgs ?? ["run"]),
      this.config.scriptPath,
      "--prompt",
      prompt,
      "--duration",
      String(params.durationSec),
      "--out-dir",
      outDir,
      ...(params.seed ? ["--seed", params.seed] : []),
      ...(this.config.musicalArgs?.(params) ?? []),
      ...(this.config.extraArgs ?? []),
    ];

    let result: ProcessResult;
    try {
      result = await this.runner(this.config.uvBinary, args, {
        timeoutMs: this.config.timeoutMs,
      });
    } catch (err) {
      throw new AdapterError(
        `${this.name} subprocess failed to start: ${String(err)}`,
        this.name,
        err,
      );
    }

    if (result.exitCode !== 0) {
      throw new AdapterError(
        `${this.name} generation failed (exit ${result.exitCode}): ${tail(result.stderr)}`,
        this.name,
      );
    }

    const parsed = parseScriptResult(result.stdout);
    if (!parsed) {
      throw new AdapterError(
        `${this.name} produced no result JSON on stdout: ${tail(result.stdout)}`,
        this.name,
      );
    }
    if (!existsSync(parsed.file)) {
      throw new AdapterError(
        `${this.name} reported missing output file: ${parsed.file}`,
        this.name,
      );
    }

    return {
      audioUrl: parsed.file,
      format: this.config.format,
      durationSec: parsed.durationSec,
      providerId: this.name,
      providerTrackId: randomUUID(),
      licenseTerms: this.config.licenseTerms,
      metadata: {
        prompt,
        genre: params.genre,
        mood: params.mood ?? null,
        script: this.config.scriptPath,
        ...parsed,
      },
    };
  }
}

/** Last JSON-parseable stdout line wins (models log noisily before it). */
export function parseScriptResult(stdout: string): LocalScriptResult | null {
  const lines = stdout.trim().split("\n").reverse();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const value = JSON.parse(trimmed) as LocalScriptResult;
      if (
        typeof value.file === "string" &&
        typeof value.durationSec === "number"
      ) {
        return value;
      }
    } catch {
      // keep scanning earlier lines
    }
  }
  return null;
}

/**
 * Per-genre musical defaults. `keyscale` and `bpm` feed ACE-Step's structured
 * conditioning (stronger than caption text) to keep chords diatonic and the
 * groove on-grid; `captionExtras` name the instruments/production/feel so the
 * model has less room to wander into off chords and off-beat bass.
 */
export interface GenreProfile {
  keyscale: string;
  bpm: number;
  captionExtras: string[];
}

const GENRE_PROFILES: Record<string, GenreProfile> = {
  lofi: {
    keyscale: "C Major",
    bpm: 75,
    // Owner-approved "true Lofi Beats" wording (2026-07-17 A/B): warm, dusty
    // and tape-saturated beats the vibe back in. The earlier "clean / steady /
    // in time / no dissonance" phrasing fixed the off chords + off-beat bass
    // but sounded sterile — the keyscale/bpm fields above keep harmony and
    // tempo locked, so the caption is free to describe character, not order.
    captionExtras: [
      "chillhop",
      "warm dusty Rhodes piano",
      "mellow jazzy maj7 chords",
      "soft upright bass",
      "laid-back swung boom-bap drums slightly behind the beat",
      "brushed hi-hats",
      "vinyl crackle",
      "tape hiss",
      "cassette wow and flutter",
      "warm analog tape saturation",
      "low-pass filtered",
      "nostalgic and cozy",
      "relaxed study beat",
    ],
  },
  sleep: {
    keyscale: "F Major",
    bpm: 58,
    // Owner-supplied "Calm Music for Sleep" wording (2026-07-17): the first
    // draft (choir aahs / string swells / cathedral reverb) missed the vibe.
    captionExtras: [
      "deep sleep ambient music",
      "slow ethereal synth pads",
      "soft minimalist piano melody",
      "spacious reverb",
      "peaceful",
      "calming",
      "heavenly atmosphere",
      "no drums",
    ],
  },
};

export function genreProfile(genre: string): GenreProfile | undefined {
  return GENRE_PROFILES[genre.trim().toLowerCase()];
}

function buildLocalPrompt(params: GenerateTrackParams): string {
  const profile = genreProfile(params.genre);
  // An explicit request BPM wins over the profile default, matching the
  // precedence in aceStepMusicalArgs so the caption text and the structured
  // --bpm flag never disagree within one request.
  const bpmText = params.bpm
    ? `${params.bpm[0]}-${params.bpm[1]} BPM`
    : profile
      ? `${profile.bpm} BPM`
      : null;
  const parts = [
    `${params.genre} music`,
    params.mood ? `${params.mood} mood` : null,
    ...(profile?.captionExtras ?? []),
    profile ? `in ${profile.keyscale}` : null,
    bpmText,
    params.instrumental ? "instrumental" : null,
    "loopable background track",
  ];
  return parts.filter(Boolean).join(", ");
}

function tail(text: string, chars = 500): string {
  const trimmed = text.trim();
  return trimmed.length > chars ? `…${trimmed.slice(-chars)}` : trimmed;
}
