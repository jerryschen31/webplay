import { describe, expect, it, vi } from "vitest";
import {
  createAceStepAdapter,
  createMusicGenAdapter,
  createStableAudioOpenAdapter,
} from "../src/local-models.js";

const neverRunner = vi.fn(async () => ({
  exitCode: 0,
  stdout: "",
  stderr: "",
}));

describe("local model factories", () => {
  it("acestep adapter targets the checkout project and turbo variant", async () => {
    const adapter = createAceStepAdapter({ runner: neverRunner });
    expect(adapter.name).toBe("acestep");
    expect(adapter.costPerTrackUSD).toBe(0);
    // no ACE-Step checkout on CI machines -> unhealthy, never a crash
    expect(await adapter.isHealthy()).toBe(false);
  });

  it("stable-audio-open adapter reports open-source terms and zero cost", () => {
    const adapter = createStableAudioOpenAdapter({ runner: neverRunner });
    expect(adapter.name).toBe("stable-audio-open");
    expect(adapter.costPerTrackUSD).toBe(0);
  });

  it("musicgen adapter is marked restricted (CC-BY-NC weights)", async () => {
    const runner = vi.fn(async (_cmd: string, args: string[]) => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
      _args: args,
    }));
    const adapter = createMusicGenAdapter({ runner });
    expect(adapter.name).toBe("musicgen");
    await expect(
      adapter.generateTrack({
        genre: "lofi",
        durationSec: 10,
        instrumental: true,
      }),
    ).rejects.toThrow(); // no JSON from stub — but the licenseTerms path is what matters below
    const args = runner.mock.calls[0]?.[1] ?? [];
    expect(args).toContain("--model-size");
  });
});
