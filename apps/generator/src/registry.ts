import {
  type AudioAdapter,
  createAceStepAdapter,
  createMusicGenAdapter,
  createStableAudioOpenAdapter,
  ElevenLabsMusicAdapter,
  MockAdapter,
} from "@webplay/adapters";

export type AdapterName =
  | "mock"
  | "elevenlabs"
  | "acestep"
  | "stable-audio-open"
  | "musicgen";

/**
 * Central place to look up an adapter by name. Remaining adapters
 * (mubert, suno/udio via aggregator) only require touching this file +
 * their own module — the CLI and orchestration code stay untouched.
 */
export function getAdapter(name: AdapterName): AudioAdapter {
  switch (name) {
    case "mock":
      return new MockAdapter();
    case "elevenlabs":
      return new ElevenLabsMusicAdapter();
    case "acestep":
      return createAceStepAdapter();
    case "stable-audio-open":
      return createStableAudioOpenAdapter();
    case "musicgen":
      return createMusicGenAdapter();
    default: {
      const exhaustive: never = name;
      throw new Error(`unknown adapter: ${String(exhaustive)}`);
    }
  }
}

export const KNOWN_ADAPTERS: readonly AdapterName[] = [
  "mock",
  "elevenlabs",
  "acestep",
  "stable-audio-open",
  "musicgen",
] as const;
