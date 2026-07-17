import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  LocalPythonAdapter,
  type ProcessResult,
  type ProcessRunner,
  parseScriptResult,
} from "../src/local.js";
import { AdapterError } from "../src/types.js";

const FIXTURE_DIR = await mkdtemp(join(tmpdir(), "webplay-local-test-"));
const SCRIPT = join(FIXTURE_DIR, "script.py");
await writeFile(SCRIPT, "# test fixture\n");

function okRunner(result: Partial<ProcessResult> = {}): ProcessRunner {
  return vi.fn(async () => ({
    exitCode: 0,
    stdout: "",
    stderr: "",
    ...result,
  }));
}

function adapterWith(runner: ProcessRunner) {
  return new LocalPythonAdapter({
    name: "test-local",
    scriptPath: SCRIPT,
    licenseTerms: "open-source",
    runner,
  });
}

describe("parseScriptResult", () => {
  it("takes the last valid JSON line amid log noise", () => {
    const stdout = [
      "loading model...",
      '{"progress": 50}',
      "done in 12s",
      '{"file": "/tmp/x.wav", "durationSec": 30, "model": "m"}',
    ].join("\n");
    expect(parseScriptResult(stdout)).toMatchObject({
      file: "/tmp/x.wav",
      durationSec: 30,
    });
  });

  it("returns null when no line satisfies the contract", () => {
    expect(parseScriptResult('log line\n{"progress": 99}\n')).toBeNull();
  });
});

describe("LocalPythonAdapter", () => {
  it("runs uv with argv (no shell) and returns the generated track", async () => {
    const audioFile = join(FIXTURE_DIR, "out.wav");
    await writeFile(audioFile, "RIFF");
    const runner = vi.fn(async (cmd: string, args: string[]) => {
      expect(cmd).toBe("uv");
      expect(args[0]).toBe("run");
      expect(args).toContain(SCRIPT);
      expect(args).toContain("--prompt");
      const prompt = args[args.indexOf("--prompt") + 1];
      expect(prompt).toContain("lofi");
      return {
        exitCode: 0,
        stdout: `noise\n{"file": "${audioFile}", "durationSec": 30}\n`,
        stderr: "",
      };
    });

    const track = await adapterWith(runner).generateTrack({
      genre: "lofi",
      durationSec: 30,
      instrumental: true,
    });

    expect(track.providerId).toBe("test-local");
    expect(track.audioUrl).toBe(audioFile);
    expect(track.durationSec).toBe(30);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("raises AdapterError with stderr tail on non-zero exit", async () => {
    const runner = okRunner({
      exitCode: 2,
      stderr: "HF_TOKEN is not set; gated model",
    });
    await expect(
      adapterWith(runner).generateTrack({
        genre: "lofi",
        durationSec: 30,
        instrumental: true,
      }),
    ).rejects.toThrow(/exit 2.*HF_TOKEN/s);
  });

  it("raises AdapterError when stdout has no result JSON", async () => {
    const runner = okRunner({ stdout: "loaded model\nno json here\n" });
    await expect(
      adapterWith(runner).generateTrack({
        genre: "lofi",
        durationSec: 30,
        instrumental: true,
      }),
    ).rejects.toThrow(AdapterError);
  });

  it("raises AdapterError when the reported file does not exist", async () => {
    const runner = okRunner({
      stdout: '{"file": "/nonexistent/webplay.wav", "durationSec": 10}\n',
    });
    await expect(
      adapterWith(runner).generateTrack({
        genre: "lofi",
        durationSec: 10,
        instrumental: true,
      }),
    ).rejects.toThrow(/missing output file/);
  });

  it("isHealthy is false when the script is missing", async () => {
    const adapter = new LocalPythonAdapter({
      name: "test-local",
      scriptPath: "/nonexistent/script.py",
      licenseTerms: "open-source",
      runner: okRunner(),
    });
    expect(await adapter.isHealthy()).toBe(false);
  });

  it("isHealthy is false when uv is unavailable", async () => {
    const runner = vi.fn(async () => {
      throw new Error("ENOENT");
    });
    expect(await adapterWith(runner).isHealthy()).toBe(false);
  });

  it("isHealthy is true when script exists and uv responds", async () => {
    expect(await adapterWith(okRunner()).isHealthy()).toBe(true);
  });
});
