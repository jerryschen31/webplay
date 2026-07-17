# /// script
# requires-python = ">=3.10,<3.12"
# dependencies = [
#   "stable-audio-tools>=0.0.19",
#   "torch>=2.3",
#   "torchaudio>=2.3",
#   "einops",
# ]
# ///
"""Generate one clip with Stable Audio Open 1.0.

Weights are gated: accept the license at
https://huggingface.co/stabilityai/stable-audio-open-1.0 and set HF_TOKEN.
Prints a single JSON result line as the last stdout line (LocalScriptResult
contract in packages/adapters/src/local.ts).
"""

import argparse
import json
import os
import sys
import time

MAX_SECONDS = 47  # model's native ceiling; stitching happens upstream


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--seed", default=None)
    parser.add_argument("--steps", type=int, default=100)
    args = parser.parse_args()

    if not os.environ.get("HF_TOKEN"):
        print(
            "HF_TOKEN is not set; stable-audio-open-1.0 is a gated model "
            "(accept its license on Hugging Face first)",
            file=sys.stderr,
        )
        return 2

    import torch
    import torchaudio
    from einops import rearrange
    from stable_audio_tools import get_pretrained_model
    from stable_audio_tools.inference.generation import generate_diffusion_cond

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    seconds = min(float(args.duration), MAX_SECONDS)

    started = time.time()
    model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
    sample_rate = model_config["sample_rate"]
    sample_size = model_config["sample_size"]
    model = model.to(device)

    conditioning = [
        {"prompt": args.prompt, "seconds_start": 0, "seconds_total": seconds}
    ]
    output = generate_diffusion_cond(
        model,
        steps=args.steps,
        cfg_scale=7,
        conditioning=conditioning,
        sample_size=sample_size,
        sigma_min=0.3,
        sigma_max=500,
        sampler_type="dpmpp-3m-sde",
        seed=int(args.seed) if args.seed else -1,
        device=device,
    )
    output = rearrange(output, "b d n -> d (b n)")
    output = (
        output.to(torch.float32)
        .div(torch.max(torch.abs(output)))
        .clamp(-1, 1)
        .mul(32767)
        .to(torch.int16)
        .cpu()
    )

    out_path = os.path.join(args.out_dir, "stable-audio-open.wav")
    torchaudio.save(out_path, output, sample_rate)

    print(
        json.dumps(
            {
                "file": out_path,
                "durationSec": seconds,
                "sampleRate": sample_rate,
                "model": "stabilityai/stable-audio-open-1.0",
                "device": device,
                "elapsedSec": round(time.time() - started, 1),
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
