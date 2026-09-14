import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aceStepMusicalArgs,
  createAceStepAdapter,
  createMusicGenAdapter,
  createStableAudioOpenAdapter,
} from "../src/local-models.js";

/** Read one flag's value out of a flat argv array. */
function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const MUSICAL_ENV = [
  "ACESTEP_KEYSCALE",
  "ACESTEP_BPM",
  "ACESTEP_INFERENCE_STEPS",
  "ACESTEP_GUIDANCE_SCALE",
] as const;

const neverRunner = vi.fn(async () => ({
  exitCode: 0,
  stdout: "",
  stderr: "",
}));

describe("local model factories", () => {
  it("acestep adapter targets the checkout project and turbo variant", async () => {
    const saved = process.env.ACESTEP_PROJECT_DIR;
    process.env.ACESTEP_PROJECT_DIR = "/nonexistent/acestep-checkout";
    try {
      const adapter = createAceStepAdapter({ runner: neverRunner });
      expect(adapter.name).toBe("acestep");
      expect(adapter.costPerTrackUSD).toBe(0);
      // checkout dir absent -> unhealthy, never a crash
      expect(await adapter.isHealthy()).toBe(false);
    } finally {
      if (saved === undefined) delete process.env.ACESTEP_PROJECT_DIR;
      else process.env.ACESTEP_PROJECT_DIR = saved;
    }
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

describe("aceStepMusicalArgs", () => {
  afterEach(() => {
    for (const key of MUSICAL_ENV) delete process.env[key];
  });

  it("applies the genre profile's key and BPM for lofi", () => {
    const args = aceStepMusicalArgs({
      genre: "lofi",
      durationSec: 300,
      instrumental: true,
    });
    expect(flag(args, "--keyscale")).toBe("C Major");
    expect(flag(args, "--bpm")).toBe("75");
    // steps/guidance stay at the script defaults (turbo path) unless env-set
    expect(args).not.toContain("--inference-steps");
    expect(args).not.toContain("--guidance-scale");
  });

  it("applies the genre profile's key and BPM for cafe", () => {
    const args = aceStepMusicalArgs({
      genre: "cafe",
      durationSec: 300,
      instrumental: true,
    });
    expect(flag(args, "--keyscale")).toBe("G Major");
    expect(flag(args, "--bpm")).toBe("90");
  });

  it("emits no key/BPM flags for an unknown genre (model auto-detects)", () => {
    const args = aceStepMusicalArgs({
      genre: "polka",
      durationSec: 30,
      instrumental: true,
    });
    expect(args).not.toContain("--keyscale");
    expect(args).not.toContain("--bpm");
  });

  it("derives BPM from an explicit range midpoint over the profile default", () => {
    const args = aceStepMusicalArgs({
      genre: "lofi",
      durationSec: 30,
      instrumental: true,
      bpm: [80, 90],
    });
    expect(flag(args, "--bpm")).toBe("85");
  });

  it("lets env engage the non-turbo quality path (steps + guidance)", () => {
    process.env.ACESTEP_KEYSCALE = "A Minor";
    process.env.ACESTEP_INFERENCE_STEPS = "32";
    process.env.ACESTEP_GUIDANCE_SCALE = "8";
    const args = aceStepMusicalArgs({
      genre: "lofi",
      durationSec: 30,
      instrumental: true,
    });
    expect(flag(args, "--keyscale")).toBe("A Minor");
    expect(flag(args, "--inference-steps")).toBe("32");
    expect(flag(args, "--guidance-scale")).toBe("8");
  });
});
