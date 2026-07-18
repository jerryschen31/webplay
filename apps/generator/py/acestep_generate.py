"""Generate one clip with ACE-Step 1.5.

Runs INSIDE the ACE-Step checkout's uv environment:
  uv run --project $ACESTEP_PROJECT_DIR python acestep_generate.py ...
(no PEP 723 header — dependencies come from that project). Set up once with:
  git clone https://github.com/ACE-Step/ACE-Step-1.5 ~/.webplay/models/ACE-Step-1.5
  cd ~/.webplay/models/ACE-Step-1.5 && uv sync
Model weights auto-download from Hugging Face (ungated) on first run.

Prints a single JSON result line as the last stdout line (LocalScriptResult
contract in packages/adapters/src/local.ts).
"""

import argparse
import json
import os
import sys
import time


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--seed", default=None)
    parser.add_argument("--variant", default="acestep-v15-turbo")
    parser.add_argument(
        "--keyscale",
        default="",
        help='Musical key e.g. "C Major" / "Am"; empty = model auto-detects. '
        "Constrains harmony so chords stay diatonic (fixes 'not real chords').",
    )
    parser.add_argument(
        "--bpm",
        type=int,
        default=None,
        help="Target BPM (30-300); omit for auto-estimate. Locks tempo so bass/"
        "drums stay on the grid (fixes off-beat notes).",
    )
    parser.add_argument(
        "--inference-steps",
        type=int,
        default=8,
        help="Diffusion steps: 8 is the turbo sweet spot; 32-100 for the "
        "non-turbo base model (more steps = cleaner harmony/timing).",
    )
    parser.add_argument(
        "--guidance-scale",
        type=float,
        default=7.0,
        help="CFG strength; higher = stricter prompt adherence. Only affects the "
        "non-turbo base model (turbo ignores it).",
    )
    parser.add_argument(
        "--quantization",
        default="int8_weight_only",
        help='torchao quantization; pass "none" to disable (16GB M4 needs it)',
    )
    parser.add_argument(
        "--project-root",
        default=os.environ.get("ACESTEP_PROJECT_DIR"),
        help="ACE-Step checkout; the Node adapter always passes this explicitly",
    )
    args = parser.parse_args()

    if not args.project_root or not os.path.isdir(args.project_root):
        print(f"invalid --project-root: {args.project_root!r}", file=sys.stderr)
        return 2

    import torch
    from acestep.handler import AceStepHandler
    from acestep.inference import GenerationConfig, GenerationParams, generate_music

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    project_root = args.project_root

    started = time.time()
    dit_handler = AceStepHandler()
    dit_handler.initialize_service(
        project_root=project_root,
        config_path=args.variant,
        device=device,
        # 16GB unified memory can't hold DiT + VAE + text encoder at once;
        # matches the repo's own defaults for the 16GB tier (gpu_config.py)
        offload_to_cpu=True,
        offload_dit_to_cpu=True,
        quantization=None if args.quantization == "none" else args.quantization,
    )

    # The optional LM handler improves prompt adherence but needs a backend
    # unavailable on macOS (vllm); plain text2music works without it.
    llm_handler = None

    params = GenerationParams(
        task_type="text2music",
        caption=args.prompt[:512],
        duration=float(args.duration),
        seed=int(args.seed) if args.seed else -1,
        inference_steps=args.inference_steps,
        guidance_scale=args.guidance_scale,
        keyscale=args.keyscale,
        bpm=args.bpm,
    )
    config = GenerationConfig(batch_size=1, audio_format="wav")

    result = generate_music(
        dit_handler, llm_handler, params, config, save_dir=args.out_dir
    )
    if not result.success or not result.audios:
        print(f"acestep generation failed: {result}", file=sys.stderr)
        return 1

    out_path = result.audios[0]["path"]
    print(
        json.dumps(
            {
                "file": out_path,
                "durationSec": float(args.duration),
                "model": args.variant,
                "device": device,
                "inferenceSteps": args.inference_steps,
                "guidanceScale": args.guidance_scale,
                "keyscale": args.keyscale or None,
                "bpm": args.bpm,
                "elapsedSec": round(time.time() - started, 1),
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
