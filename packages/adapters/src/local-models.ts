import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { LocalPythonAdapter, type LocalPythonAdapterConfig } from "./local.js";

/**
 * Directory containing the PEP 723 generator scripts. Resolvable from both
 * src and dist because the py/ scripts live in apps/generator/py at the
 * repo root; callers can override per adapter via scriptDir.
 */
export interface LocalModelOptions {
  scriptDir?: string;
  runner?: LocalPythonAdapterConfig["runner"];
  timeoutMs?: number;
}

function defaultScriptDir(): string {
  // packages/adapters/{src,dist} -> repo root -> apps/generator/py
  const fromPackage = join(import.meta.dirname, "../../../apps/generator/py");
  return fromPackage;
}

/**
 * ACE-Step 1.5 — priority local model. Apache/MIT-licensed code, ungated
 * weights, MLX/MPS support. Runs inside a checkout of the ACE-Step repo
 * (its deps aren't on PyPI), located via ACESTEP_PROJECT_DIR.
 */
export function createAceStepAdapter(
  options: LocalModelOptions = {},
): LocalPythonAdapter {
  const projectDir =
    process.env.ACESTEP_PROJECT_DIR ??
    join(homedir(), ".webplay/models/ACE-Step-1.5");
  const scriptDir = options.scriptDir ?? defaultScriptDir();
  return new (class extends LocalPythonAdapter {
    override async isHealthy(): Promise<boolean> {
      // The ACE-Step checkout must exist in addition to the base checks.
      if (!existsSync(projectDir)) return false;
      return super.isHealthy();
    }
  })({
    name: "acestep",
    scriptPath: join(scriptDir, "acestep_generate.py"),
    licenseTerms: "open-source",
    uvArgs: ["run", "--project", projectDir, "python"],
    extraArgs: [
      "--variant",
      process.env.ACESTEP_VARIANT ?? "acestep-v15-turbo",
      // explicit so the script never guesses from env/cwd
      "--project-root",
      projectDir,
    ],
    runner: options.runner,
    timeoutMs: options.timeoutMs,
  });
}

/**
 * Stable Audio Open 1.0 — priority local model. Weights are gated on
 * Hugging Face: accept the license and set HF_TOKEN. Native max length is
 * ~47s; longer requests are clamped by the script (stitching lands with
 * the Liquidsoap work in Phase 1).
 */
export function createStableAudioOpenAdapter(
  options: LocalModelOptions = {},
): LocalPythonAdapter {
  const scriptDir = options.scriptDir ?? defaultScriptDir();
  return new LocalPythonAdapter({
    name: "stable-audio-open",
    scriptPath: join(scriptDir, "stable_audio_generate.py"),
    licenseTerms: "open-source",
    runner: options.runner,
    timeoutMs: options.timeoutMs,
  });
}

/**
 * MusicGen — benchmark comparison ONLY. Meta's pretrained weights are
 * CC-BY-NC: output must not enter the commercial rotation. Kept in the
 * bake-off to calibrate open-model quality.
 */
export function createMusicGenAdapter(
  options: LocalModelOptions = {},
): LocalPythonAdapter {
  const scriptDir = options.scriptDir ?? defaultScriptDir();
  return new LocalPythonAdapter({
    name: "musicgen",
    scriptPath: join(scriptDir, "musicgen_generate.py"),
    licenseTerms: "restricted",
    extraArgs: ["--model-size", process.env.MUSICGEN_MODEL_SIZE ?? "small"],
    runner: options.runner,
    timeoutMs: options.timeoutMs,
  });
}
