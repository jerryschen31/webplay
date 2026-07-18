import { type AudioAdapter, MockAdapter } from "@webplay/adapters";

export type AdapterName = "mock";

/**
 * Central place to look up an adapter by name. Real adapters
 * (elevenlabs, mubert, musicgen-local, ...) will be added here in
 * subsequent sessions and only require touching this file + their own
 * package — the CLI and orchestration code stay untouched.
 */
export function getAdapter(name: AdapterName): AudioAdapter {
  switch (name) {
    case "mock":
      return new MockAdapter();
    default: {
      const exhaustive: never = name;
      throw new Error(`unknown adapter: ${String(exhaustive)}`);
    }
  }
}

export const KNOWN_ADAPTERS: readonly AdapterName[] = ["mock"] as const;
