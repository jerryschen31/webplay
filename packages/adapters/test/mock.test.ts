import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { MockAdapter, synthSineWav } from "../src/index.js";

describe("MockAdapter", () => {
  it("reports healthy by default", async () => {
    const adapter = new MockAdapter();
    expect(await adapter.isHealthy()).toBe(true);
  });

  it("reports unhealthy when configured", async () => {
    const adapter = new MockAdapter({ healthy: false });
    expect(await adapter.isHealthy()).toBe(false);
  });

  it("generates a track and writes a valid WAV file", async () => {
    const adapter = new MockAdapter();
    const track = await adapter.generateTrack({
      genre: "lofi",
      durationSec: 1,
      instrumental: true,
    });

    expect(track.format).toBe("wav");
    expect(track.providerId).toBe("mock");
    expect(track.durationSec).toBe(1);
    expect(track.licenseTerms).toBe("open-source");

    const fileStat = await stat(track.audioUrl);
    expect(fileStat.size).toBeGreaterThan(44); // larger than WAV header
  });

  it("writes a WAV header that round-trips through inspection", async () => {
    const adapter = new MockAdapter({ sampleRate: 22050 });
    const track = await adapter.generateTrack({
      genre: "lofi",
      durationSec: 0.5,
      instrumental: true,
    });
    const buf = await readFile(track.audioUrl);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(buf.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(buf.readUInt32LE(24)).toBe(22050); // sample rate
    expect(buf.readUInt16LE(22)).toBe(1); // mono
    expect(buf.readUInt16LE(34)).toBe(16); // bits per sample
  });

  it("propagates genre + sample rate into metadata", async () => {
    const adapter = new MockAdapter({ sampleRate: 16000, frequencyHz: 220 });
    const track = await adapter.generateTrack({
      genre: "jazz",
      durationSec: 0.25,
      instrumental: true,
    });
    expect(track.metadata).toMatchObject({
      synthetic: true,
      genre: "jazz",
      sampleRate: 16000,
      frequencyHz: 220,
    });
  });

  it("simulates failures when configured", async () => {
    const adapter = new MockAdapter({ failNextN: 2 });
    await expect(
      adapter.generateTrack({
        genre: "lofi",
        durationSec: 1,
        instrumental: true,
      }),
    ).rejects.toThrow(/forced failure/);
    await expect(
      adapter.generateTrack({
        genre: "lofi",
        durationSec: 1,
        instrumental: true,
      }),
    ).rejects.toThrow(/forced failure/);
    // third call should succeed
    const track = await adapter.generateTrack({
      genre: "lofi",
      durationSec: 1,
      instrumental: true,
    });
    expect(track.providerId).toBe("mock");
  });

  it("synthSineWav produces expected byte length", () => {
    const buf = synthSineWav({
      durationSec: 1,
      sampleRate: 8000,
      frequencyHz: 440,
    });
    expect(buf.length).toBe(44 + 8000 * 2);
  });
});
