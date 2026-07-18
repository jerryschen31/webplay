# Listening test protocol — Phase 0 Feature 2

Scaffold for the blind quality bake-off (notes/phase0-feature2.md §4),
sized to the surviving providers.

## Informal results so far (owner, 2026-07-17)

- **ACE-Step 1.5** (30s lofi, turbo/int8): *"sounds good."*
- **Stable Audio Open** (45s lofi): *"right vibe but the drum beat is
  too obnoxious and off rhythm."* → prompt away drums; use for
  textures/interludes.

These are directional, not decisive — run the structured test below
before finalizing per-channel assignments.

## Protocol

1. **Matrix**: providers {acestep, stable-audio-open, elevenlabs?} ×
   moods {sleepy, focused, rainy, sunset} × 3 tracks each, 60–90s
   excerpts, 4–5 listeners. (~36 clips ≈ one sitting per listener.)
2. **Generate** with the CLI, one folder per provider; then **rename to
   anonymous ids** (`clip-01.wav` …) and record the mapping privately in
   `bench-results/listening/key.csv` (gitignored).
3. Listeners rate each clip 1–5 on: musicality, repetitiveness (5 = not
   repetitive), loop-ability, mood fit. One sheet per listener from the
   template below.
4. Tabulate mean per (provider, mood) cell; a provider wins a mood cell
   at ≥0.5 mean advantage. Ties → prefer the cheaper/safer provider
   (local, permissive license).

## Rating sheet template

Copy to `bench-results/listening/scores-<listener>.csv`:

```csv
clip_id,musicality_1to5,repetitiveness_1to5,loopability_1to5,mood_fit_1to5,notes
clip-01,,,,,
clip-02,,,,,
```

## Outputs

- Winner per mood cell recorded in docs/phase0-feature2-decision.md.
- Prompt-tuning notes (e.g. drum descriptors that fix SAO's rhythm
  problem) fed into the Phase 0 Feature 3 prompt templates.
