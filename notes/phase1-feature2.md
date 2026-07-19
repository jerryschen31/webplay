# Phase 1 — Feature 2: Wire Generator Worker → R2 → Liquidsoap Playlist

> **Revision 2026-07-17**:
> - **The generator worker runs on the M4 (or a future Mac Mini), not
>   the droplet** — the primary provider is now local ACE-Step, and the
>   model lives where Apple Silicon lives. The droplet only mixes and
>   serves; the Mac generates and uploads to R2.
> - Provider order inverted from the original guess: **ACE-Step local
>   primary → SAO textures → ElevenLabs optional premium** (see
>   docs/phase0-feature2-decision.md). Failover is local-first, so
>   "provider degraded" mostly means machine-busy, not API-down.
> - Keep the model **resident** between jobs (ACE-Step's `acestep-api`
>   server or a long-lived Python process): cold start is ~3 min/track,
>   warm ~40s per 30s audio (docs/bench-m4-local.md).
> - The publish job MUST refuse tracks with `licenseTerms:
>   "restricted"` (MusicGen guard — enforced in code, not convention).
> - BullMQ/Redis is likely overkill for a single-machine V1 — a simple
>   SQLite/D1-backed job table + cron is enough until multi-channel.
> - `adapter.isHealthy()` and the bench harness (`pnpm bench`) already
>   exist from Phase 0 — reuse them for the health-ping and cost-meter
>   items below.

## What This Feature Is

Builds the **library replenishment loop**: a scheduled background worker that continuously generates new AI tracks using the adapter from Phase 0 Feature 2, curates them (with a lightweight human-in-the-loop step), pushes approved tracks into Cloudflare R2, and ensures Liquidsoap automatically picks them up on its periodic playlist reload. This is what keeps the channel feeling fresh forever — never the same playlist on a loop.

## Why It Matters

- A static 20-hour library would feel stale within a few weeks for daily listeners.
- Continuous, automated replenishment is the operational backbone of a 24/7 radio.
- Without an automated pipeline, the project becomes a constant manual chore — and it dies.

## Implementation Steps

### 1. Generator Worker Architecture
- [ ] `apps/generator` is a long-running Node process (TypeScript) on the **M4 (or future Mac Mini)** — the local models it drives need Apple Silicon; the droplet only mixes/serves (see revision block above).
- [ ] V1 orchestration: a simple SQLite/D1-backed job table + cron — single machine, no Redis. Revisit BullMQ only if generation spreads across machines.
- [ ] Three job stages: `generate`, `master`, `publish`.

### 2. Scheduling
- [ ] Cron tick every 30 minutes: enqueue N `generate` jobs based on current library depth.
- [ ] Target depth: 25 hours per channel. If current depth < 25h, generate enough to top up + 1h buffer.
- [ ] Cap per-day generation per channel (e.g., 10 new tracks/day/channel) to control cost.

### 3. Generate Job
- [ ] Consumes from `generate` queue.
- [ ] Selects adapter for the channel (primary commercial first — likely Mubert or Eleven Labs Music; on failure, fallback to secondary commercial, then to local M4-hosted MusicGen / Stable Audio Open / ACE-Step as final fragmentation-proof fallback).
- [ ] Selects a prompt template from `apps/generator/prompts/lofi.json` with weighted random mood/instrument variation.
- [ ] Calls `adapter.generateTrack(...)`.
- [ ] On success: download audio to local `/var/tmp/webplay/raw/`. Enqueue `master` job.
- [ ] On failure: retry 3x with exponential backoff. After final failure, alert Discord + skip.

### 4. Master Job
- [ ] Runs FFmpeg pipeline:
  - Loudness normalize to -16 LUFS.
  - Trim leading/trailing silence (<0.5s).
  - Encode to 128 kbps AAC + 192 kbps MP3 (AAC for stream, MP3 for downloads).
- [ ] Compute audio fingerprint (chromaprint) to detect near-duplicates → discard if duplicate of existing track.
- [ ] Enqueue `publish` job with paths to mastered files.

### 5. Curation Gate (Human-in-the-Loop, Lightweight)
- [ ] Mastered tracks go to a `pending` folder in R2.
- [ ] Internal review tool from Phase 0 Feature 3 surfaces new tracks daily.
- [ ] Approver hits ✅ / ❌ — accepted tracks move to `approved/` and are inserted into the `tracks` Postgres table.
- [ ] **Auto-approve mode (optional, Phase 2):** if audio quality metrics (LUFS, spectral analysis, no clipping) pass a learned threshold, auto-approve without human review. Phase 1 keeps human gate on.

### 6. Liquidsoap Pickup
- [ ] Liquidsoap's `playlist(reload=300)` already re-scans the library every 5 minutes — no extra plumbing needed.
- [ ] When `rclone sync` (from Phase 1 Feature 1) pulls new approved tracks down, they appear in `/var/lib/webplay/lofi/`, and the next reload picks them up.
- [ ] Retired tracks: a `retired_at` column in Postgres + a cleanup script that moves files out of the active folder. Use this to age out tracks that get high skip counts.

### 7. Observability
- [ ] Generator emits metrics: `tracks_generated_total`, `tracks_failed_total`, `tracks_approved_total`, `generation_latency_seconds`, `provider_used`.
- [ ] Dashboard in Grafana: track library depth in hours per channel; alert if drops below 20h.
- [ ] Cost meter: log estimated API cost per generation, sum daily, alert if monthly budget projection exceeds $100.

### 8. Provider Failover Logic
- [ ] On any adapter failure that's not a content-policy rejection, mark provider as degraded for 15 min, route subsequent jobs to fallback.
- [ ] Daily health-check ping (`adapter.isHealthy()`) per provider — if 3 consecutive failures, page operator.

## Definition of Done
- [ ] Worker has been running for 72 hours straight, generating new Lofi tracks autonomously.
- [ ] Library depth stays between 20–30 hours without manual intervention.
- [ ] Daily curation queue takes <15 minutes for the operator to clear.
- [ ] Liquidsoap is observably playing tracks generated in the last 48 hours (verify via now-playing log).
- [ ] Failover from primary to fallback provider tested (manually break primary API key; confirm fallback kicks in).

## Risks
- Curation backlog grows → enforce daily review SLA; relax generation rate if needed.
- Duplicate detection misses near-duplicates → tune chromaprint threshold; spot-check weekly.
- Provider returns subtly broken audio (clipping, wrong duration) → mastering step must reject these.

## Estimated Effort
**4–6 days.** Job orchestration + curation tool are most of the work.
