# Phase 0 — Feature 3: Generate the 20-Hour Lofi Seed Library

> **Revision 2026-07-17** (post Feature 2 outcome — see
> docs/phase0-feature2-decision.md):
> - Batch generator is **ACE-Step 1.5 local on the M4** (not Mubert /
>   Eleven Labs as originally guessed). SAO supplies percussion-light
>   interlude beds; MusicGen is excluded (CC-BY-NC).
> - Generate at **240–300s per track** directly (ACE-Step supports it
>   natively) — no stitching.
> - Run the batch through a **resident-model worker** (`uv run
>   acestep-api` in the checkout) — per-process cold start is ~3 min,
>   warm inference ~8× faster (docs/bench-m4-local.md). Overnight
>   batches on the M4; ~1.5× overgeneration to cover the 60–70% keep
>   rate.
> - Prompt tuning: fold in listening-test feedback (SAO drums off-rhythm
>   → "soft brushed drums", "no drums" descriptors; see
>   docs/listening-test.md).
> - Catalog DB: consider **Cloudflare D1** instead of Supabase/Neon —
>   the stack is CF-first now (web on Workers, R2 token live) and D1
>   keeps auth/billing in one place. Decide at implementation time.

## What This Feature Is

Produces the **initial rotating audio library for the Lofi channel** — roughly 20 hours of commercially-licensed, AI-generated instrumental tracks (about 300–400 tracks at 3–4 minutes each). This library is what Liquidsoap will shuffle through 24/7 in Phase 1. Building it now de-risks the launch: when we flip Phase 1 on, there is already enough material that no casual listener will hear a repeat within a typical session.

## Why It Matters

- **No library = no stream.** Without a seed library, there is nothing to broadcast.
- **20 hours is the magic number.** Average session length is ~1 hour; even a heavy 4-hour study session won't loop. Generating 20 hours upfront gives us a strong week-one product.
- **Quality bar lives or dies here.** The Lofi channel is the launch flagship. If these tracks aren't great, the launch fails. Human curation is non-negotiable at this stage.

## Implementation Steps

### 1. Define the Lofi Aesthetic
Create `docs/channel-spec-lofi.md`:
- BPM range: 70–95
- Instrumentation: muted piano, soft drums, vinyl crackle, occasional jazz guitar, ambient pads
- Mood: warm, melancholic-but-hopeful, never aggressive
- Forbidden: vocals, sharp transients, builds/drops, dance elements
- Reference tracks: 5–10 hand-picked Spotify lofi tracks we love (for vibe-matching prompts)

### 2. Prompt Engineering
- [ ] Draft 30–50 prompt templates, each parameterized: `{instrumentation}`, `{mood}`, `{tempo}`, `{texture}`.
- [ ] Example: `"Slow lofi hip hop instrumental, 75 BPM, {instrument}, soft tape hiss, melancholic but warm, no vocals, seamless loop friendly"`.
- [ ] Vary prompts to avoid library sameness — rotate moods (sleepy / focused / rainy / sunset).

### 3. Batch Generation
- [ ] Use the Feature 2 winner: **ACE-Step 1.5 local (primary)**, Stable Audio Open for interlude textures. (Original guess — Mubert/Eleven Labs primary — inverted by cost + licensing reality; see docs/phase0-feature2-decision.md.)
- [ ] Run `apps/generator` in batch mode: queue 500 tracks (with 20% buffer for rejections).
- [ ] Each track tagged with metadata: prompt, provider, generation timestamp, license tier.
- [ ] Store raw outputs in `r2://webplay-library/lofi/raw/`.

### 4. Human Curation Pass
- [ ] Build a tiny internal review tool (Next.js page, gated): play track, hit ✅ accept / ❌ reject / 🔁 fix-loop / 🎵 promote-to-premium.
- [ ] Target keep-rate: ~60–70% (so 500 generated → ~300–350 accepted).
- [ ] Reject reasons: too short, audible artifacts, off-genre, bad ending, vocals leaked in.
- [ ] Accepted tracks move to `r2://webplay-library/lofi/approved/`.
- [ ] Tracks flagged as exceptional get a `premium=true` flag for future use.

### 5. Audio Mastering & Normalization
- [ ] Run accepted tracks through FFmpeg pipeline:
  - Loudness normalize to -16 LUFS (streaming standard).
  - Trim leading/trailing silence to <0.5s.
  - Encode to 192 kbps MP3 + 128 kbps AAC (the AAC is what HLS will use).
- [ ] Add ID3 tags: title (auto-generated), artist (`webplay.io`), genre (`Lofi`), license note.

### 6. Catalog Database
- [ ] Postgres (Supabase or Neon free tier) table `tracks`:
  - `id`, `channel`, `file_url`, `duration_sec`, `bpm`, `mood_tags[]`, `provider`, `prompt`, `created_at`, `approved_at`, `premium`, `play_count`, `skip_count`.
- [ ] Catalog ingestion script: scan R2 `approved/` folder, populate Postgres.

### 7. Sanity Listen
- [ ] Play the full 20-hour library on shuffle for one workday. Note any tracks that jar — re-curate.
- [ ] Spot-check crossfade smoothness: place two random tracks back-to-back via Liquidsoap test config, confirm 4-second crossfade sounds clean.

## Definition of Done
- [ ] At least **300 approved tracks** (~20 hours) in `r2://webplay-library/lofi/approved/`.
- [ ] Postgres `tracks` table populated and queryable.
- [ ] All tracks normalized to -16 LUFS and encoded to 128 kbps AAC.
- [ ] One full workday played on shuffle without an unbearable track.
- [ ] `docs/channel-spec-lofi.md` finalized and ready to be the template for channels 2–5 in Phase 2.

## Risks
- Generation API throws rate limits → batch over multiple days; respect provider quotas.
- Keep-rate is lower than expected → loosen prompts, generate more raw tracks, accept ~$50 overage.
- Licensing terms shift mid-batch → confirm legal status with provider before bulk generation begins.

## Estimated Effort
**4–5 days.** Bulk of time is human curation listening, which can't be parallelized.
