export interface GenerateTrackParams {
  genre: string;
  durationSec: number;
  mood?: string;
  bpm?: [number, number];
  instrumental: boolean;
  seed?: string;
  prompt?: string;
}

export type AudioFormat = "mp3" | "wav" | "flac" | "aac";

export type LicenseTerms =
  | "commercial-free"
  | "commercial-paid"
  | "open-source"
  | "restricted";

export interface GeneratedTrack {
  audioUrl: string;
  format: AudioFormat;
  durationSec: number;
  providerId: string;
  providerTrackId: string;
  licenseTerms: LicenseTerms;
  metadata: Record<string, unknown>;
}

export interface AudioAdapter {
  readonly name: string;
  readonly costPerTrackUSD: number;
  generateTrack(params: GenerateTrackParams): Promise<GeneratedTrack>;
  isHealthy(): Promise<boolean>;
}

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly adapter: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}
