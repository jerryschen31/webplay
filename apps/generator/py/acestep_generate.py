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
    )

    # The optional LM handler improves prompt adherence but needs a backend
    # unavailable on macOS (vllm); plain text2music works without it.
    llm_handler = None

    params = GenerationParams(
        task_type="text2music",
        caption=args.prompt[:512],
        duration=float(args.duration),
        seed=int(args.seed) if args.seed else -1,
        inference_steps=8,  # turbo variant sweet spot
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
                "elapsedSec": round(time.time() - started, 1),
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
