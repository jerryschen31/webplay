# Phase 0 Feature 2 — Local AI music generation: what's built, results, next steps

Status as of 2026-07-17. Companion docs: [bench-m4-local.md](bench-m4-local.md)
(benchmark detail), notes/phase0-feature2.md (original feature spec),
notes/webplay-brainstorming-20260521-revised.md (target architecture).

## What was implemented

**Adapter infrastructure** (`packages/adapters`)
- `AudioAdapter` interface (`generateTrack()` / `isHealthy()` /
  `costPerTrackUSD`) with `MockAdapter` for tests and offline dev.
- `fetchWithRetry`: timeout, exponential backoff + jitter, Retry-After,
  caller-abort passthrough — shared by all HTTP adapters.
- `ElevenLabsMusicAdapter` (commercial fallback; blocked on paid plan —
  free tier gets HTTP 402 on the Music API).
- `LocalPythonAdapter`: runs uv-managed Python generator scripts as
  argv-only subprocesses; scripts print a final JSON line
  (`LocalScriptResult`); stderr tails surface in `AdapterError`.

**Local model adapters** (`packages/adapters/src/local-models.ts` +
`apps/generator/py/*.py`)
| adapter | model | status | license posture |
|---|---|---|---|
| `acestep` | ACE-Step 1.5 turbo (checkout at `~/.webplay/models/ACE-Step-1.5`) | ✅ working on M4 | MIT code, ungated weights — primary candidate |
| `stable-audio-open` | Stable Audio Open 1.0 (gated HF weights, `HF_TOKEN`) | ✅ working on M4 | Stability community license — verify revenue terms in PR 5 |
| `musicgen` | Meta MusicGen small/medium | built, not yet run | CC-BY-NC weights — benchmark only, never in rotation |

**Tooling**
- CLI: `pnpm generate --provider=<name> --genre=lofi --duration=240`
- Bench: `pnpm bench --provider=<name> --runs=N --duration=S` →
  latency/failure/cost JSON+CSV in `bench-results/`
- 43 unit tests, all model interaction mocked; CI downloads nothing.

**Hard-won 16GB-M4 fixes** (all in `apps/generator/py/`)
- ACE-Step: `offload_to_cpu` + `offload_dit_to_cpu` +
  torchao `int8_weight_only` — without these, MPS OOMs (11.7GiB model vs
  18.1GiB cap).
- Stable Audio Open: Python pinned `<3.12`, `numpy<2`,
  `pytorch-lightning` + `soundfile` added, and a scoped float64→float32
  patch for `DiffusionTransformer.apg_project` (MPS has no float64).

## Real-run results (M4 16GB, MPS)

| | ACE-Step 1.5 turbo | Stable Audio Open 1.0 |
|---|---|---|
| clip benchmarked | 30s | 45s (native ceiling ~47s) |
| wall clock/track | 206–246s cold (mean 226s) | ~462–513s |
| warm inference | ~37s (load dominates) | not yet isolated |
| success rate | 3/3 | 1/1 + bench run 1/1 |
| marginal cost | $0 | $0 |

**Listening feedback (owner, 2026-07-17):** ACE-Step lofi sample sounds
good. SAO has the right vibe but drums are obnoxious and off-rhythm →
use SAO for ambient/percussion-light textures (prompt away drums) or
interludes; ACE-Step is the primary track generator.

## Next steps

### A. Long-form tracks (4–5 min)
- ACE-Step natively supports 10–600s — generate 240–300s tracks
  directly (`--duration=280`). **Next bench: 3 runs at 280s** to get the
  real wall-clock and confirm memory holds. SAO stays capped ~47s; use
  it for beds/interludes, not full tracks.
- Prompt tuning per channel (e.g. "soft brushed drums" for lofi) — feed
  the listening-test scaffold (PR 5).
- Kill the ~3-min cold start: run generation through a resident-model
  worker (ACE-Step ships a REST server — `uv run acestep-api`) instead
  of one process per track. This is the Generator Worker of Phase 1
  Feature 1 and turns 30s clips from ~226s → ~40s.

### B. Serving to webplay.io with semi-seamless crossfade
The revised brainstorming architecture already targets exactly the
fade-out/fade-in requirement; in order:
1. **Phase 1 Feature 1–2 (Generator → storage):** nightly/idle batch on
   the M4 generates N tracks per channel; upload to **Cloudflare R2**
   (token already has R2 permissions; create bucket `webplay-tracks`).
2. **Phase 1 Feature 2 (mixing):** a small always-on Linux box (DO
   droplet in the notes) runs **Liquidsoap**, which pulls the track
   playlist from R2 and does the crossfading natively —
   `crossfade(fade_out=3., fade_in=3., …)` gives precisely the "brief
   fade out, fade back in" behavior — and emits a continuous AAC
   stream chopped into HLS segments.
3. **Phase 1 Feature 3 (edge delivery):** segments + `playlist.m3u8`
   land back in R2; a **Cloudflare Worker** serves
   `GET /stream/{channel}/…` from R2, cached at every PoP (zero egress
   — the cost win in the notes).
4. **Phase 1 Feature 4 (player):** `apps/web` (already live at
   webplay.io on Workers) gets an `<audio>` + hls.js player and
   now-playing metadata.

Interim shortcut (before the droplet exists): pre-render the crossfades
offline — ffmpeg `afade`/`acrossfade` between consecutive tracks when
building each channel's daily playlist — and publish a static HLS
playlist to R2. Loses live scheduling, gains a working webplay.io
stream with zero new infrastructure. Worth doing as Phase 1 Feature 1's
first milestone.

### C. Process/bookkeeping
- Merge PRs #1–#4 (order: 1 → 2 → 3 → 4).
- PR 5: `docs/provider-licensing.md` (verify Stability community
  license revenue terms + ACE-Step weights license in writing),
  cost-model doc, listening-test scaffold, go/no-go decision doc.
- Deferred/parked: Mubert ($49/mo), Suno/Udio aggregator, ElevenLabs
  (needs paid plan; only if local quality proves insufficient for a
  "centerpiece" tier), MusicGen bench run, 24h soak test.
