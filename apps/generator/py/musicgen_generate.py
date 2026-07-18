# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "transformers>=4.44",
#   "torch>=2.3",
#   "scipy",
#   "sentencepiece",
# ]
# ///
"""Generate one clip with Meta MusicGen (BENCHMARK USE ONLY).

The pretrained weights are CC-BY-NC — output must not be used commercially.
Prints a single JSON result line as the last stdout line (LocalScriptResult
contract in packages/adapters/src/local.ts).
"""

import argparse
import json
import os
import sys
import time

MAX_SECONDS = 30  # single-pass ceiling; fine for benchmark clips
FRAMES_PER_SECOND = 50


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--seed", default=None)
    parser.add_argument("--model-size", default="small", choices=["small", "medium"])
    args = parser.parse_args()

    import scipy.io.wavfile
    import torch
    from transformers import AutoProcessor, MusicgenForConditionalGeneration

    if args.seed is not None:
        torch.manual_seed(int(args.seed))

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    seconds = min(float(args.duration), MAX_SECONDS)
    model_id = f"facebook/musicgen-{args.model_size}"

    started = time.time()
    processor = AutoProcessor.from_pretrained(model_id)
    model = MusicgenForConditionalGeneration.from_pretrained(model_id).to(device)

    inputs = processor(text=[args.prompt], padding=True, return_tensors="pt").to(device)
    audio_values = model.generate(
        **inputs,
        do_sample=True,
        guidance_scale=3.0,
        max_new_tokens=int(seconds * FRAMES_PER_SECOND),
    )

    sample_rate = model.config.audio_encoder.sampling_rate
    audio = audio_values[0, 0].cpu().float().numpy()
    out_path = os.path.join(args.out_dir, "musicgen.wav")
    scipy.io.wavfile.write(out_path, rate=sample_rate, data=audio)

    print(
        json.dumps(
            {
                "file": out_path,
                "durationSec": round(len(audio) / sample_rate, 2),
                "sampleRate": sample_rate,
                "model": model_id,
                "device": device,
                "elapsedSec": round(time.time() - started, 1),
                "license": "CC-BY-NC (benchmark only)",
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
