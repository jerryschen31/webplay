# Local generation benchmarks — MacBook M4 16GB

## ACE-Step 1.5 (acestep-v15-turbo, int8_weight_only, CPU offload, MPS)

2026-07-17, 3 sequential runs of a 30s lofi clip via `pnpm bench
--provider=acestep --runs=3 --duration=30` (raw JSON/CSV in
bench-results/, gitignored; sample WAV in bench-results/samples/).

| metric | value |
|---|---|
| success rate | 3/3 |
| wall clock per track | 206–246s (mean 226s) |
| pure inference (per ACE-Step's own telemetry) | ~4.6s/step × 8 steps ≈ 37s |
| model load + quantization overhead per process | ~170–200s |
| marginal cost | $0 |

Key takeaway: **~85% of wall time is per-process model load.** The
Phase 1 generator worker must keep the model resident (long-lived
process or ACE-Step's REST server mode) instead of spawning per track —
warm throughput is roughly one 30s clip per ~40s, so a 3-minute track
should land well under ~5 minutes warm. Even cold, 25 tracks/day fits
in ~1.6h of overnight compute.

Memory: first attempt OOM'd MPS (11.7GiB model vs 18.1GiB cap); the
working configuration is offload_to_cpu + offload_dit_to_cpu +
torchao int8_weight_only (see apps/generator/py/acestep_generate.py).
Machine remains usable during generation but expect memory pressure;
schedule volume generation when idle.

## Stable Audio Open 1.0 (MPS, 100 steps)

2026-07-17: first 45s clip in 513s end-to-end; warm bench run 461s.
Bench series interrupted by owner (coverage deemed sufficient for now).
Output is ~47.5s for a 45s request (model over-delivers slightly).
Owner listening note: right vibe, but drums obnoxious/off-rhythm — use
for percussion-light textures/interludes, not primary tracks.

## MusicGen — parked (benchmark-only; CC-BY-NC weights, never ran)
