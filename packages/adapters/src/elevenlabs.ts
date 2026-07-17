import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireEnv } from "./env.js";
import { type FetchWithRetryOptions, fetchWithRetry } from "./http.js";
import {
  AdapterError,
  type AudioAdapter,
  type GeneratedTrack,
  type GenerateTrackParams,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.elevenlabs.io";
const MIN_LENGTH_MS = 3_000;
const MAX_LENGTH_MS = 600_000;

export interface ElevenLabsAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  modelId?: "music_v1" | "music_v2";
  retry?: FetchWithRetryOptions;
}

/**
 * ElevenLabsMusicAdapter — Eleven Music compose API (POST /v1/music).
 * The endpoint returns raw MP3 bytes; we persist them to a temp file so
 * GeneratedTrack.audioUrl stays a local path like every other adapter.
 *
 * Licensing: commercial use requires a paid ElevenLabs plan; free-tier
 * output is not cleared for redistribution (see docs/provider-licensing.md).
 */
export class ElevenLabsMusicAdapter implements AudioAdapter {
  readonly name = "elevenlabs";
  // Rough mid-tier estimate per 3-minute track; actual cost is
  // credit-based and plan-dependent. Revisit during cost modeling.
  readonly costPerTrackUSD = 0.5;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelId: string;
  private readonly retry: FetchWithRetryOptions;

  constructor(options: ElevenLabsAdapterOptions = {}) {
    try {
      this.apiKey = options.apiKey ?? requireEnv("ELEVENLABS_API_KEY");
    } catch (err) {
      throw new AdapterError((err as Error).message, "elevenlabs", err);
    }
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.modelId = options.modelId ?? "music_v1";
    this.retry = options.retry ?? {};
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(
        `${this.baseUrl}/v1/user`,
        { headers: { "xi-api-key": this.apiKey } },
        { ...this.retry, attempts: 1, timeoutMs: 15_000 },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateTrack(params: GenerateTrackParams): Promise<GeneratedTrack> {
    const prompt = params.prompt ?? buildPrompt(params);
    const lengthMs = Math.min(
      Math.max(params.durationSec * 1000, MIN_LENGTH_MS),
      MAX_LENGTH_MS,
    );

    const res = await fetchWithRetry(
      `${this.baseUrl}/v1/music?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          music_length_ms: lengthMs,
          model_id: this.modelId,
          force_instrumental: params.instrumental,
        }),
      },
      this.retry,
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AdapterError(
        `eleven music generation failed: HTTP ${res.status} ${detail.slice(0, 500)}`,
        this.name,
      );
    }

    const audio = Buffer.from(await res.arrayBuffer());
    if (audio.length === 0) {
      throw new AdapterError("eleven music returned an empty body", this.name);
    }

    // request-id is provider-controlled and ends up in file paths (here and
    // in the CLI); only accept a conservative charset, else mint our own.
    const requestId = res.headers.get("request-id");
    const trackId =
      requestId && /^[A-Za-z0-9_-]{1,128}$/.test(requestId)
        ? requestId
        : randomUUID();
    const dir = await mkdtemp(join(tmpdir(), "webplay-elevenlabs-"));
    const filePath = join(dir, `${trackId}.mp3`);
    await writeFile(filePath, audio);

    return {
      audioUrl: filePath,
      format: "mp3",
      durationSec: lengthMs / 1000,
      providerId: this.name,
      providerTrackId: trackId,
      licenseTerms: "commercial-paid",
      metadata: {
        modelId: this.modelId,
        prompt,
        bytes: audio.length,
        genre: params.genre,
        mood: params.mood ?? null,
        rawRequestId: requestId,
      },
    };
  }
}

function buildPrompt(params: GenerateTrackParams): string {
  const parts = [
    `${params.genre} track`,
    params.mood ? `with a ${params.mood} mood` : null,
    params.bpm ? `around ${params.bpm[0]}-${params.bpm[1]} BPM` : null,
    params.instrumental ? "instrumental, no vocals" : null,
    "suitable for continuous background radio listening",
  ];
  return parts.filter(Boolean).join(", ");
}
