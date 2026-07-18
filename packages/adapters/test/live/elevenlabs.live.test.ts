import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ElevenLabsMusicAdapter } from "../../src/elevenlabs.js";
import { hasCredentials } from "../../src/env.js";

/**
 * Live smoke test — hits the real Eleven Music API and spends credits.
 * Runs only via `pnpm test:live` with ELEVENLABS_API_KEY present; never in CI.
 */
describe.skipIf(!hasCredentials("elevenlabs"))("elevenlabs live", () => {
  it(
    "generates a short real track end-to-end",
    async () => {
      const adapter = new ElevenLabsMusicAdapter();

      expect(await adapter.isHealthy()).toBe(true);

      const track = await adapter.generateTrack({
        genre: "lofi",
        durationSec: 15,
        mood: "calm",
        instrumental: true,
      });

      const audio = await readFile(track.audioUrl);
      expect(audio.length).toBeGreaterThan(10_000);
      // MP3 sanity: ID3 tag or MPEG frame sync at the start
      const isId3 = audio.subarray(0, 3).toString() === "ID3";
      const isFrameSync =
        audio[0] === 0xff && ((audio[1] ?? 0) & 0xe0) === 0xe0;
      expect(isId3 || isFrameSync).toBe(true);
    },
    { timeout: 300_000 },
  );
});
