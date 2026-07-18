import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AudioAdapter,
  GeneratedTrack,
  GenerateTrackParams,
} from "./types.js";

export interface MockAdapterOptions {
  healthy?: boolean;
  failNextN?: number;
  sampleRate?: number;
  frequencyHz?: number;
}

/**
 * MockAdapter — synthesizes a deterministic PCM sine-wave WAV file at the
 * requested duration. Used for tests and offline pipeline development; never
 * a candidate for production rotation.
 */
export class MockAdapter implements AudioAdapter {
  readonly name = "mock";
  readonly costPerTrackUSD = 0;

  private failuresRemaining: number;
  private readonly sampleRate: number;
  private readonly frequencyHz: number;
  private healthy: boolean;

  constructor(opts: MockAdapterOptions = {}) {
    this.healthy = opts.healthy ?? true;
    this.failuresRemaining = opts.failNextN ?? 0;
    this.sampleRate = opts.sampleRate ?? 22050;
    this.frequencyHz = opts.frequencyHz ?? 440;
  }

  async isHealthy(): Promise<boolean> {
    return this.healthy;
  }

  async generateTrack(params: GenerateTrackParams): Promise<GeneratedTrack> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error(
        `mock adapter forced failure (remaining: ${this.failuresRemaining})`,
      );
    }

    const wav = synthSineWav({
      durationSec: params.durationSec,
      sampleRate: this.sampleRate,
      frequencyHz: this.frequencyHz,
    });

    const dir = await mkdtemp(join(tmpdir(), "webplay-mock-"));
    const trackId = randomUUID();
    const filePath = join(dir, `${trackId}.wav`);
    await writeFile(filePath, wav);

    return {
      audioUrl: filePath,
      format: "wav",
      durationSec: params.durationSec,
      providerId: this.name,
      providerTrackId: trackId,
      licenseTerms: "open-source",
      metadata: {
        synthetic: true,
        genre: params.genre,
        sampleRate: this.sampleRate,
        frequencyHz: this.frequencyHz,
      },
    };
  }
}

interface SynthOpts {
  durationSec: number;
  sampleRate: number;
  frequencyHz: number;
}

/**
 * Build a minimal mono 16-bit PCM WAV buffer with a single sine tone.
 * Keeps the test fixture out of git while remaining deterministic.
 */
export function synthSineWav(opts: SynthOpts): Buffer {
  const { durationSec, sampleRate, frequencyHz } = opts;
  const numSamples = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);

  // fmt chunk
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buf.writeUInt16LE(bytesPerSample, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  const twoPiF = 2 * Math.PI * frequencyHz;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((twoPiF * i) / sampleRate);
    const intSample = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    buf.writeInt16LE(intSample | 0, headerSize + i * bytesPerSample);
  }

  return buf;
}
