# Phase 0 — Feature 2: Validate AI Generation Pipeline

## What This Feature Is

Before investing in any streaming infrastructure, we need hard evidence that we can reliably generate **commercially-licensed, high-quality, 3–4 minute AI music tracks** at the volume and consistency required for a 24/7 radio station. This feature prototypes the **modular adapter pattern** (`generateTrack()`) and benchmarks a wide candidate pool — **commercial APIs** (Suno, Udio, Eleven Labs Music, Mubert, Stable Audio hosted) and **open-source / self-hostable models** (MusicGen, Stable Audio Open, ACE-Step 1.5, Riffusion, YuE) — side-by-side. We also evaluate running open-source generators **locally on the operator's MacBook M4 (16GB unified memory)** as a zero-marginal-cost path that doubles as the ultimate insurance against API fragmentation. The output is a go/no-go decision on which 2–3 providers form the V1 stack and whether local generation is viable for ongoing replenishment.

## Why It Matters

- **API fragmentation is the #1 existential risk.** Neither Suno nor Udio offer fully stable public APIs as of 2026 — many users go through aggregators (302.ai, APIframe). Eleven Labs Music and Mubert do publish official APIs, so they're safer commercial bets. Open-source models eliminate the API risk entirely.
- **Licensing varies wildly.** Some providers permit commercial streaming on free tiers; others require enterprise contracts; open-source models give us full ownership rights but shift the burden of training-data provenance to us. We must know the terms before we ship.
- **Quality varies by genre.** Suno may dominate vocal pop but be mid for ambient; Stable Audio may shine for nature pads; Mubert specializes in seamless looping background music; MusicGen is strong on instrumental composition. A multi-provider, per-channel routing strategy is the right design.
- **Cost floor matters.** If a fully self-hosted open-source pipeline on the M4 produces acceptable quality, we can run for ~$0 marginal generation cost forever — which transforms the unit economics.

## Implementation Steps

### 1. Define the Adapter Interface
Create `packages/adapters/src/types.ts`:
```ts
export interface GenerateTrackParams {
  genre: string;           // "lofi" | "jazz" | "ambient" | ...
  durationSec: number;     // typically 180-240
  mood?: string;           // "calm" | "uplifting" | "melancholic"
  bpm?: [number, number];  // optional range
  instrumental: boolean;   // always true for V1
  seed?: string;           // for reproducibility if supported
}

export interface GeneratedTrack {
  audioUrl: string;        // direct download URL
  format: 'mp3' | 'wav' | 'flac';
  durationSec: number;
  providerId: string;
  providerTrackId: string;
  licenseTerms: 'commercial-free' | 'commercial-paid' | 'restricted';
  metadata: Record<string, unknown>;
}

export interface AudioAdapter {
  name: string;
  generateTrack(params: GenerateTrackParams): Promise<GeneratedTrack>;
  isHealthy(): Promise<boolean>;
}
```

### 2. Implement Adapters (Broad Candidate Pool)

**Commercial APIs:**
- [ ] **`SunoAdapter`** — via official API if available, else through 302.ai / APIframe aggregator.
- [ ] **`UdioAdapter`** — same approach; aggregator fallback documented.
- [ ] **`ElevenLabsMusicAdapter`** — [elevenlabs.io/music](https://elevenlabs.io/music). Official API, mature SDK, predictable pricing. Strong candidate for primary commercial provider.
- [ ] **`MubertAdapter`** — [mubert.com/api](https://mubert.com/api). Purpose-built for licensed background music streams; supports infinite generation, genre presets, BPM control. Likely the best fit for our "ambient/background" use case.
- [ ] **`StableAudioAdapter`** — Stability AI's hosted API.

**Open-source / self-hostable (priority for fallback + cost floor):**
- [ ] **`AceStepAdapter`** — [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5). Recent open-source song generator. Run via Replicate, RunPod, or locally on M4.
- [ ] **`MusicGenAdapter`** — Meta's MusicGen (small/medium/large). Apache 2.0. Most mature open-source music model. Runs comfortably on the M4 via MLX or PyTorch with MPS backend.
- [ ] **`StableAudioOpenAdapter`** — Stability AI's open-source release; CC-BY-SA-style license. Excellent for sound design, ambient textures, nature loops.
- [ ] **`RiffusionAdapter`** — open-source diffusion model that produces spectrograms then renders to audio. Good for experimental/electronic.
- [ ] **`YuEAdapter`** — open foundation model targeting full song generation with vocals (we'll keep instrumental-only for V1).
- [ ] **`MagnetAdapter`** — Meta's masked audio generation; faster than MusicGen at comparable quality on some genres.

**Local-first execution (MacBook M4 16GB):**
- [ ] Document MLX-optimized paths for MusicGen and Stable Audio Open — these target Apple Silicon's Neural Engine and unified memory directly.
- [ ] Fall back to PyTorch with `device='mps'` for models without MLX ports (ACE-Step, Riffusion).
- [ ] Benchmark per-track wall-clock time. Expected ranges on M4 16GB:
  - MusicGen-small (300M params): ~30–60s per 3-min track.
  - MusicGen-medium (1.5B): ~2–4 min per 3-min track.
  - Stable Audio Open: ~1–2 min per 90s clip (note: native max ~47s; we'll generate multiple clips and stitch).
  - ACE-Step 1.5: TBD — flag during benchmark.
- [ ] 16GB is the practical ceiling — MusicGen-large (3.3B) will likely thrash. Stick to small/medium locally; reserve large-model use for hosted inference.
- [ ] Build a thin **`LocalAdapter`** that wraps a Python subprocess (`uv run` invocation of the model script) and returns the generated WAV file path. Same `generateTrack()` interface — the orchestrator doesn't care that it's local.

**Adapter contract for all:**
- [ ] Each adapter has unit tests with mocked HTTP responses (or mocked subprocess for local).
- [ ] Each adapter exposes `isHealthy()` (HTTP status endpoint, or for local adapters: a check that the model weights exist and the subprocess can start).
- [ ] Each adapter declares its `costPerTrackUSD` (0 for local) for budget tracking.

### 3. Licensing Research (Document Per Provider)
Create `docs/provider-licensing.md` with one row per provider covering:
- [ ] Plan tier required for commercial streaming.
- [ ] Whether attribution is required.
- [ ] Whether the output can be re-distributed (essential for our use case).
- [ ] Whether downloads can be resold to end-users (matters for $0.10 download tier).
- [ ] Cost per track at each tier.
- [ ] For open-source models: model weights license (Apache 2.0, CC-BY-SA, custom), training-data provenance disclosures, any "no-commercial-use" carve-outs.
- [ ] Mubert specifically: confirm streaming-station licensing tier and whether the per-track fee covers unlimited listener fan-out.
- [ ] Eleven Labs Music: confirm "Music API" terms around commercial redistribution of generated tracks.
- [ ] Reach out to provider sales/legal teams if terms are ambiguous — get written confirmation.

### 4. Quality A/B Listening Test
- [ ] **Shortlist** to a manageable bake-off: pick top 5 candidates from the pool (e.g., Suno, Eleven Labs, Mubert, MusicGen-medium-local, Stable Audio Open-local). Five providers × five channels × 10 tracks = 250 tracks — enough signal without overwhelming the listening panel.
- [ ] Blind-listen test with 3–5 friends rating each on a 1–5 scale: musicality, repetitiveness, loop-ability, mood fit.
- [ ] Tabulate scores per (provider, genre) cell.
- [ ] Decision: assign best-scoring provider as primary per channel, second-best as fallback. **Strong preference** for at least one open-source/local option in the final stack to guarantee API-failure resilience.

### 5. Cost Modeling
- [ ] Compute cost-per-track at each commercial provider's tier.
- [ ] Multiply by replenishment rate (e.g., 5 new tracks/day/channel × 5 channels = 25 tracks/day = 750/mo).
- [ ] Confirm projected monthly cost lands under $80 (per main cost model).
- [ ] Compute the **local-only** scenario: M4 wall-clock time per track × tracks-per-day → does the laptop have enough idle hours to keep all channels topped up? If yes, the marginal generation cost floor is **$0** plus electricity.
- [ ] Document a **blended strategy**: use Mubert/Eleven Labs for "centerpiece" high-quality tracks, fill the long tail with local MusicGen generations. This optimizes the cost-per-listening-hour metric.

### 6. Robustness Testing
- [ ] Run each adapter 100x sequentially; record failure rate, retry behavior, latency.
- [ ] Confirm exponential-backoff retry logic works.
- [ ] Confirm rate limits don't break overnight batch jobs.
- [ ] For local adapters: run a 24-hour soak generating tracks continuously. Confirm M4 thermals stay reasonable, no memory leaks across many invocations, and disk I/O doesn't bottleneck. If thermals are a concern, throttle to 50% duty cycle (generate-then-cool).

## Definition of Done
- [ ] `pnpm run generate --provider=<name> --genre=lofi` produces a valid MP3 in <5 min for every adapter in the shortlist (commercial + local).
- [ ] All shortlisted adapters pass `isHealthy()` checks.
- [ ] `docs/provider-licensing.md` is committed with verified, citable terms for every provider (including open-source weights licenses).
- [ ] Listening test scores recorded; primary + fallback provider chosen per channel.
- [ ] M4 local-generation benchmark recorded (tracks/hour, peak RAM, thermal behavior).
- [ ] Decision document committed: which 2–3 providers we'll launch with, including at least one open-source/local option as a fragmentation hedge.

## Risks
- Suno/Udio block our automation accounts → fall back to Eleven Labs / Mubert (official APIs) or local MusicGen on the M4.
- Aggregator (302.ai) ToS changes → maintain ability to switch aggregators quickly; avoid aggregator dependency for any channel whose primary provider has an official API.
- Open-source model quality lags commercial offerings → use local generation as filler/fallback, not primary, until quality parity is verified.
- M4 thermals or competing local workloads disrupt generation → schedule generation overnight; consider a dedicated Mac Mini if the model proves the laptop is the bottleneck.

## Estimated Effort
**5–7 days.** Most of the time is the listening test + licensing diligence, not coding.
