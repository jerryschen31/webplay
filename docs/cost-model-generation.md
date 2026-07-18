# Generation cost model — Phase 0 Feature 2

2026-07-17. Based on measured M4 benchmarks (docs/bench-m4-local.md) and
provider pricing exercised this week. Replenishment target from
notes/phase0-feature2.md: 5 tracks/day/channel × 5 channels = 750
tracks/month (3–4 min each) at steady state; launch is 1 channel (150/mo).

## Scenarios (monthly, 750 tracks at ~3.5 min)

| scenario | generation cost | notes |
|---|---|---|
| ElevenLabs only | **~$394** ($0.15/min × 3.5 min × 750) | 5× the $80 total infra budget — ruled out |
| Local only (ACE-Step on M4) | **~$0** + electricity (~$2–4) | ~37s warm inference per 30s audio ⇒ a 3.5-min track ≈ 4–5 min warm compute ⇒ 750 tracks ≈ 55–65 h/mo ≈ 2 h/day, fits overnight idle. Cold-start (~3 min/track) must be amortized via a resident-model worker |
| Blended (local volume + 50 EL "centerpiece" tracks) | **~$26** | only if the listening test shows EL adds audible value for lofi; requires EL paid plan + license verification |

Launch scale (1 channel, 150 tracks/mo) is ~12 h/mo of M4 compute —
negligible.

## Cost floor sensitivities

- **M4 availability** is the real constraint, not dollars: generation
  competes with the owner's use of the laptop. Mitigations: overnight
  batches (notes' plan), duty-cycle throttling in the bench/soak
  harness, and — if the channel count grows — a one-time ~$600 Mac Mini
  becomes the "generation server" and pays for itself vs ElevenLabs in
  under 2 months at full replenishment rate.
- **Per-track wall clock at 4–5 min duration is not yet measured**
  (bench was 30s clips). Action: `pnpm bench --provider=acestep
  --runs=3 --duration=280` before committing to the replenishment
  schedule.
- **Quality-rejection rate** multiplies compute: at a 60–70% keep rate
  (phase0-feature3 target), effective compute is ~1.5× the accepted
  count. Local cost stays ~$0; only wall-clock budget grows.

## Budget line (vs the $80/mo cap in the brainstorming notes)

| item | $/mo |
|---|---|
| Generation (local primary) | ~0 |
| ElevenLabs (optional premium, 50 tracks) | 0–26 |
| Droplet (Phase 1) | 6–12 |
| R2 + Workers | 2–7 |
| **Total** | **~$10–45** — comfortably under budget with room for the EL premium tier if it earns its keep |
