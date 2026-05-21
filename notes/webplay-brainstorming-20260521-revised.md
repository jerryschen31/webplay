# webplay.io — 24/7 AI-Generated Music Streaming
**Brainstorming & Launch Roadmap (Revised)**
*Date: 2026-05-21*

---

## 1. Concept Summary

webplay.io is a zero-friction, no-signup-required web destination offering **24/7 live streams of AI-generated music**, organized by mood/genre channels. Every listener of a given channel hears the **same synchronized stream** — like a global radio station. This decouples AI generation costs from user growth: whether 5 or 50,000 people are tuned in, generation cost is identical.

**Tagline ideas:** "Always on. Always new." / "AI radio for focus, sleep, and vibes."

---

## 2. Launch Channels (V1)

Start with 5 channels.

| Channel | Use Case | Target Audience |
|---|---|---|
| **Lofi Beats for Study** | Focus, work, homework | Students, remote workers |
| **Calm Music for Sleep** | Bedtime, meditation | Insomnia, anxiety relief |
| **Jazz Lounge** | Background, dinner, reading | Cafés, ambient listeners |
| **Electronic / Synthwave** | Coding, gaming, gym | Devs, creators, streamers |
| **Nature + Ambient** | Deep focus, white noise | Writers, meditators |

**V2 expansion candidates:** Classical for Reading, Coffee Shop Jazz, Cyberpunk, Forest Sounds, Piano Solo, Rainy Day, Space Ambient.

---

## 3. Technical Architecture (Revised — Hybrid Droplet + Cloudflare)

A naive "single droplet streams directly to listeners" model breaks at scale: the droplet must hold thousands of simultaneous TCP connections, and standard CDNs don't cache infinite streams well. The revised architecture splits responsibilities between a continuously-running droplet (the kitchen) and Cloudflare's serverless edge (the buffet).

### Why Not Just Cloudflare Workers?

Cloudflare Workers are serverless: they wake on a request, run for ~10–50ms of CPU, then disappear. They have no concept of a continuous timeline and lack access to native audio binaries (FFmpeg, Liquidsoap). Audio broadcasting requires the opposite: a process that ticks forward 24/7, crossfading MP3s and emitting a steady audio frame stream. So a small always-on Linux server is unavoidable for the **generation/mixing** stage — but Workers + R2 are perfect for the **distribution** stage.

### The Pipeline

```
┌────────────────────────────┐   HLS    ┌──────────────────────┐   m3u8   ┌──────────────────────────┐
│  DigitalOcean Droplet      │ segments │  Cloudflare R2       │  + .aac  │  Cloudflare Workers      │
│  ($4–$12/mo, always-on)    │ ───────► │  (object storage)    │ ───────► │  (edge delivery)         │
│  • Liquidsoap mixes tracks │          │  • 4s .aac chunks    │          │  • Serves playlist+chunks│
│  • Slices into 4s HLS      │          │  • Rolling .m3u8 idx │          │  • Cached at every PoP   │
│  • Uploads continuously    │          └──────────────────────┘          │  • Free egress on core   │
└────────────────────────────┘                                            └──────────────────────────┘
        ▲                                                                              │
        │ generated tracks                                                             ▼
┌────────────────────────────┐                                            ┌──────────────────────────┐
│  Generator Worker          │                                            │  Browser <audio> + HLS   │
│  • Adapter pattern         │                                            │  • Fetches m3u8          │
│  • Suno/Udio/Stable-Audio  │                                            │  • Pulls .aac segments   │
│  • Writes to R2 library    │                                            │  • Gapless playback      │
└────────────────────────────┘                                            └──────────────────────────┘
```

### A. Generator Worker (Modular Adapter Pattern)
- Runs as a cron job or long-lived process on the droplet.
- Exposes an internal `generateTrack({genre, duration, mood})` interface.
- **Pluggable adapters (V1 candidate pool):**
  - **Commercial APIs:** `SunoAdapter`, `UdioAdapter`, `ElevenLabsMusicAdapter` ([elevenlabs.io/music](https://elevenlabs.io/music)), `MubertAdapter` ([mubert.com/api](https://mubert.com/api) — purpose-built for licensed background music streams, possibly our best-fit commercial option), `StableAudioAdapter` (Stability AI hosted).
  - **Open-source / self-hostable:** `AceStepAdapter` ([ACE-Step](https://github.com/ace-step/ACE-Step-1.5)), `MusicGenAdapter` (Meta's MusicGen, mature + Apache 2.0), `StableAudioOpenAdapter` (Stability's open-source release, Apache-style license), `RiffusionAdapter` (open-source diffusion model), `YuEAdapter` (open foundation model for full songs), `MagnetAdapter` (Meta's masked audio generation).
  - **Local-first option:** the operator's **MacBook M4 16GB** can host MLX-optimized MusicGen / Stable Audio Open / ACE-Step for free generation. M4 Neural Engine + unified memory is well-suited; expect ~30s–2min per 3-minute track depending on model. This is the **zero-marginal-cost path** and the strongest insurance against API fragmentation.
- **Critical: commercial APIs may fragment.** Neither Suno nor Udio offer fully stable public APIs as of 2026 — most production users go through aggregators (302.ai, APIframe) that reverse-engineer endpoints. Eleven Labs and Mubert do offer official APIs, which makes them safer commercial bets. The adapter pattern + a self-hosted open-source fallback (MusicGen on the M4, or Stable Audio Open on a cheap GPU instance) means the project survives any single provider going dark overnight.
- Maintains a **rotating library of ~20 hours per channel** in R2; shuffled dynamically so casual listeners never hear repeats.
- Human-in-the-loop curation step: tracks must pass a quick listen-check before entering rotation.

### B. The Droplet — Liquidsoap Engine ($4–$12/mo)
- Single small Linux instance (1 GB RAM is plenty).
- **Liquidsoap** runs continuously per channel: opens MP3s from local cache, crossfades, outputs a continuous audio stream.
- **FFmpeg / Liquidsoap HLS output** chops the stream into **4-second .aac segments** and writes a rolling `.m3u8` playlist index.
- Segments are uploaded to Cloudflare R2 immediately.
- **Zero listeners ever connect directly** to this droplet — it's a private kitchen.

### C. Cloudflare R2 + Workers (The Global Buffet)
- R2 holds the rolling window of recent .aac segments + the .m3u8 index per channel.
- A Cloudflare Worker serves `GET /stream/{channel}/playlist.m3u8` and `GET /stream/{channel}/seg-N.aac` from R2.
- Cached at every Cloudflare PoP — 50,000 simultaneous listeners cost nearly the same as 5.
- **Cloudflare R2 has zero egress fees.** Combined with Worker free tier (100k req/day) + paid Workers ($5/mo for 10M req), this scales for pennies.

### D. Why 4-Second Chunks?

To the listener it sounds like one unbroken stream of full 3–4 minute songs. The 4-second slicing is a low-level CDN trick:

```
[ 4-min AI song playing live on droplet ]
                │
                ▼ (Liquidsoap chops to 4s pieces)
  ┌───────────┬───────────┬───────────┬───────────┐
  │ seg1.aac  │ seg2.aac  │ seg3.aac  │ seg4.aac  │  ...24/7
  └───────────┴───────────┴───────────┴───────────┘
                │
                ▼ (uploaded to R2, served by Workers)
  [ Cloudflare Edge CDN — cached at every PoP ]
                │
                ▼
  [ Browser stitches seamlessly via HLS — 100% gapless ]
```

Because chunks split on audio frame boundaries, transitions are imperceptible. Each chunk is a tiny static file CF can cache and replicate worldwide — bandwidth cost approaches $0.

### Frontend
- **Next.js on Vercel** (free tier).
- Channel grid landing page → click to play.
- HTML5 `<audio>` + **hls.js** library for HLS playback in browsers (Safari plays HLS natively).
- **Audio-reactive visualizer** (Web Audio API + WebGL / three.js).
- Now-playing metadata fetched from a separate Worker that reads track metadata from R2.

---

## 4. Cost Model (Revised)

**Assumption: 10,000 daily listeners, ~1 hour average session, 5 channels.**

| Component | Monthly Cost | Notes |
|---|---|---|
| AI music generation (API + aggregators) | $0–$80 | $0 if running fully on M4 / open-source models; $30–$80 if using Suno/Udio/Eleven Labs/Mubert premium tiers. Mubert in particular is purpose-built for streaming licensing. |
| DigitalOcean Droplet (Liquidsoap engine) | $4–$12 | Basic instance; zero listener load |
| Cloudflare R2 storage | $1.50 | ~100GB rolling library + segment window |
| Cloudflare R2 egress | **$0** | Zero egress fees — the key cost win |
| Cloudflare Workers | $0–$5 | Free tier handles small launches; $5 covers 10M req/mo |
| Vercel frontend hosting | $0 | Hobby/Pro tier |
| Domain (webplay.io) | ~$3 | Annualized |
| **Total** | **~$40–$100/mo** | Flat regardless of listener count |

**Scaling to 100k DAU:** costs stay roughly flat (~$120/mo). The main upward pressure is generation API cost if we expand channel count, not bandwidth.

---

## 5. Monetization

### Tier 1 — Free Listener (the funnel)
- No signup. Hit play.
- Display ads in side panels (don't block the visualizer).
- **Audio-reactive visualizer real estate** sold as premium ad slots — sponsors get branded backgrounds.

### Tier 2 — Micro-transactions
- **"Save to Playlist"** button: $0.10 to download MP3 or export to Spotify.
- Heart/like a track → unlock download.

### Tier 3 — Subscription ($3–$5/mo)
- Ad-free.
- Unlimited downloads.
- Higher bitrate (256 kbps).
- Access to "Deep" channels (rare/experimental genres).
- Custom channel mixing (blend lofi + jazz).

### Tier 4 — B2B Licensing
- **Streamer/Creator licenses**: Twitch/YouTube creators license the stream as copyright-free background music ($10–$30/mo per creator).
- White-label streams for cafés, co-working spaces, retail ($50+/mo).

### Revenue Projection (Conservative, 12 months in)
- 50k DAU, 2% subscription conversion = 1,000 subs × $4 = **$4,000/mo**
- 200 creator licenses × $15 = **$3,000/mo**
- Display ads on 50k DAU = **$1,500–$3,000/mo**
- Micro-transactions = **$500/mo**
- **Total: ~$9k–$10k/mo at <$200/mo costs.**

---

## 6. Roadmap

### Phase 0 — Foundation (Weeks 1–2)
Detailed implementation plans for each feature live in separate files:
- **[phase0-feature1.md](phase0-feature1.md)** — Lock domain, set up repo, CI/CD
- **[phase0-feature2.md](phase0-feature2.md)** — Validate AI generation pipeline (Suno/Udio/Stable-Audio adapter prototypes)
- **[phase0-feature3.md](phase0-feature3.md)** — Generate the 20-hour Lofi seed library

### Phase 1 — MVP (Weeks 3–6)
Detailed implementation plans for each feature live in separate files:
- **[phase1-feature1.md](phase1-feature1.md)** — Stand up Liquidsoap droplet with HLS output
- **[phase1-feature2.md](phase1-feature2.md)** — Wire Generator Worker → R2 → Liquidsoap playlist
- **[phase1-feature3.md](phase1-feature3.md)** — Cloudflare R2 + Worker edge delivery layer
- **[phase1-feature4.md](phase1-feature4.md)** — Build Next.js frontend with Lofi channel
- **[phase1-feature5.md](phase1-feature5.md)** — Audio-reactive visualizer (Web Audio API + canvas/WebGL)
- **[phase1-feature6.md](phase1-feature6.md)** — Internal launch + uptime monitoring

### Phase 2 — Multi-Channel Launch (Weeks 7–10)
- Generate libraries for remaining 4 channels.
- Channel grid UI, smooth crossfade between channels.
- Now-playing metadata + track history.
- Basic analytics (PostHog or Plausible).
- **Public launch** — Product Hunt, HN, r/InternetIsBeautiful, lofi/study subreddits.

### Phase 3 — Monetization Layer (Weeks 11–16)
- Ad slots (Carbon Ads or direct sponsors).
- Stripe integration for subscription tier.
- "Save to Playlist" micro-transaction flow + Spotify OAuth export.
- Auth (passwordless email magic link).

### Phase 4 — Growth & B2B (Months 5–7)
- Creator license portal — self-serve signup, dashboard, license certificate.
- Twitch/YouTube outreach partnerships.
- SEO content: "best lofi for studying", "AI music for sleep".
- Mobile-friendly PWA + "add to home screen" prompt.

### Phase 5 — Differentiation (Months 8–12)
- User-influenced channels: vote on mood, tempo, instrumentation in real-time.
- "Mood blend" custom channels for subscribers.
- Anonymous live listener count, chat per channel.
- Mobile native apps (React Native) if web traction validates.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **AI API fragmentation / blocked accounts** | Modular adapter pattern (`generateTrack()` interface); 2+ commercial providers (Mubert + Eleven Labs have official APIs and are safer than Suno/Udio); local-first fallback running MusicGen / Stable Audio Open / ACE-Step on the operator's MacBook M4 16GB |
| AI music API ToS restricts commercial streaming | Confirm licensing per provider; document provenance per track |
| Generation quality dips on certain genres | Human-in-the-loop curation before tracks enter rotation |
| Cloudflare R2/Workers policy change | Bunny CDN + Wasabi fallback path documented |
| Droplet failure interrupts stream | Health-check monitor + auto-restart; warm standby droplet for V2 |
| Copyright claims on AI music | Use providers with clear commercial licenses; per-track provenance log |
| Listener fatigue / repetitiveness | Continuously refresh library; Liquidsoap skip-tracking analytics |

---

## 8. Success Metrics

- **North Star:** Concurrent listeners (proxy for stickiness).
- **D1/D7/D30 return rate** (anonymous cookie sessionization).
- **Average session length** (target: 45+ min).
- **Free → paid conversion** (target: 2% at 6 months).
- **Cost per 1k listener-hours** (should stay near-zero thanks to R2 egress).

---

## 9. Why This Wins

- **Zero friction.** No login, no app, no decisions — hit play.
- **High Time-On-Site.** Lofi tabs stay open 4+ hours.
- **Marginal cost ≈ $0.** Every new listener is pure margin — R2 egress is free.
- **Defensible library.** Months of curated AI generation = moat new entrants can't replicate overnight.
- **Domain match.** webplay.io = instant comprehension.
