# webplay.io — 24/7 AI-Generated Music Streaming
**Brainstorming & Launch Roadmap**
*Date: 2026-05-21*

---

## 1. Concept Summary

webplay.io is a zero-friction, no-signup-required web destination offering **24/7 live streams of AI-generated music**, organized by mood/genre channels. Every listener of a given channel hears the **same synchronized stream** — like a global radio station. This decouples AI generation costs from user growth: whether 5 or 50,000 people are tuned in, generation cost is identical.

**Tagline ideas:** "Always on. Always new." / "AI radio for focus, sleep, and vibes."

---

## 2. Launch Channels (V1)

Start with 5 channels — enough variety to capture distinct moods without overextending the generation pipeline.

| Channel | Use Case | Target Audience |
|---|---|---|
| **Lofi Beats for Study** | Focus, work, homework | Students, remote workers |
| **Calm Music for Sleep** | Bedtime, meditation | Insomnia, anxiety relief |
| **Jazz Lounge** | Background, dinner, reading | Cafés, ambient listeners |
| **Electronic / Synthwave** | Coding, gaming, gym | Devs, creators, streamers |
| **Nature + Ambient** | Deep focus, white noise | Writers, meditators |

**V2 expansion candidates:** Classical for Reading, Coffee Shop Jazz, Cyberpunk, Forest Sounds, Piano Solo, Rainy Day, Space Ambient.

---

## 3. Technical Architecture

### Three-Component Backend

```
┌───────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  Generator Worker │ -> │ Icecast + Liquidsoap │ -> │  Cloudflare CDN │ -> Listeners
│  (AI music APIs)  │    │ (virtual radio mix)  │    │  (HLS delivery) │
└───────────────────┘    └──────────────────────┘    └─────────────────┘
```

### A. Generator Worker
- Background Node/Python script.
- Calls **Suno / Udio / Stable-Audio** APIs to generate 3-minute seamless instrumental tracks.
- Stores tracks in S3/R2 organized by channel.
- Maintains a **rotating library of ~20 hours per channel** — shuffled dynamically so casual listeners never hear repeats.
- Continually adds fresh tracks; retires stale ones.

### B. Virtual Radio Station (Icecast + Liquidsoap)
- Runs on a $12/mo DigitalOcean droplet (one droplet handles all channels initially).
- Liquidsoap mixes tracks into a continuous stream per channel.
- Outputs one MP3/AAC stream URL per channel at 128 kbps.

### C. CDN Delivery (Cloudflare)
- Wrap the Icecast streams in **HLS** (HTTP Live Streaming) so they look like normal HTTP traffic.
- Cloudflare's unmetered egress on core tiers keeps bandwidth bill near $0.
- Backup option: Fastly or Bunny CDN.

### Frontend
- **Next.js on Vercel** (free tier).
- Channel grid landing page → click to play.
- HTML5 `<audio>` element pulling the HLS stream.
- **Audio-reactive visualizer** (Web Audio API + WebGL / three.js) — pixel-art loop or 3D shader.
- Now-playing metadata fetched from Icecast endpoint.

---

## 4. Cost Model

**Assumption: 10,000 daily listeners, ~1 hour average session, 5 channels.**

| Component | Monthly Cost | Notes |
|---|---|---|
| AI music generation APIs | $30–$60 | Premium tier across Suno/Udio for seed library refresh |
| Icecast/Liquidsoap droplet | $12 | Single DigitalOcean instance, scales vertically |
| Object storage (R2/S3) | $5 | ~100GB of MP3 library across channels |
| Vercel frontend hosting | $0 | Hobby/Pro tier |
| Cloudflare CDN bandwidth | $0–$20 | Unmetered on core network |
| Domain (webplay.io) | ~$3 | Annualized |
| **Total** | **~$50–$100/mo** | Flat regardless of listener count |

**Scaling to 100k DAU:** costs stay roughly flat (~$150/mo) thanks to CDN egress economics. The main upward pressure is generation API cost if we expand channel count.

---

## 5. Monetization

### Tier 1 — Free Listener (the funnel)
- No signup required. Just hit play.
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
- [ ] Lock domain, set up repo, CI/CD.
- [ ] Validate AI generation pipeline: test Suno + Udio APIs for quality and licensing terms.
- [ ] Generate a 20-hour seed library for Lofi channel as proof-of-concept.

### Phase 1 — MVP (Weeks 3–6)
- [ ] Stand up Icecast + Liquidsoap droplet.
- [ ] Wire generator worker → object storage → Liquidsoap playlist.
- [ ] Build Next.js frontend with 1 channel (Lofi).
- [ ] Basic visualizer (audio-reactive canvas).
- [ ] Cloudflare CDN in front of stream.
- [ ] Internal launch — share with 10 friends, measure uptime.

### Phase 2 — Multi-Channel Launch (Weeks 7–10)
- [ ] Generate libraries for remaining 4 channels.
- [ ] Channel grid UI, smooth crossfade between channels.
- [ ] Now-playing metadata + track history.
- [ ] Basic analytics (PostHog or Plausible).
- [ ] **Public launch** — Product Hunt, HN, r/InternetIsBeautiful, lofi/study subreddits.

### Phase 3 — Monetization Layer (Weeks 11–16)
- [ ] Ad slots integrated (start with Carbon Ads or direct sponsors).
- [ ] Stripe integration for subscription tier.
- [ ] "Save to Playlist" micro-transaction flow + Spotify OAuth export.
- [ ] Auth (passwordless email magic link).

### Phase 4 — Growth & B2B (Months 5–7)
- [ ] Creator license portal — self-serve signup, dashboard, license certificate.
- [ ] Twitch/YouTube outreach: partner with mid-tier streamers for cross-promo.
- [ ] SEO content: "best lofi for studying", "AI music for sleep" — capture search intent.
- [ ] Mobile-friendly PWA + "add to home screen" prompt.

### Phase 5 — Differentiation (Months 8–12)
- [ ] User-influenced channels: vote on mood, tempo, instrumentation in real-time.
- [ ] "Mood blend" custom channels for subscribers.
- [ ] Community features: anonymous live listener count, chat per channel.
- [ ] Mobile native apps (React Native) if web traction validates.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI music API ToS restricts commercial streaming | Confirm licensing upfront; have 2+ providers; fall back to self-hosted Stable Audio if needed |
| Generation quality dips on certain genres | Manual curation step — human listens before track enters rotation |
| Cloudflare bandwidth policy change | Have Bunny/Fastly contingency; monitor CF AUP for streaming |
| Spotify/Suno changes export APIs | Don't depend on one provider for downloads; offer direct MP3 always |
| Copyright claims on AI music | Use providers with clear commercial licenses; document provenance per track |
| Listener fatigue / repetitiveness | Continuously refresh library; track "skips" via Liquidsoap analytics |

---

## 8. Success Metrics

- **North Star:** Concurrent listeners (proxy for stickiness).
- **D1/D7/D30 return rate** (sessionized via anonymous cookie).
- **Average session length** (target: 45+ min — this is study/sleep music).
- **Free → paid conversion** (target: 2% at 6 months).
- **Cost per 1k listener-hours** (should stay near-zero).

---

## 9. Why This Wins

- **Zero friction.** No login, no app install, no decisions — just hit play.
- **High Time-On-Site.** People leave lofi tabs open for 4+ hours.
- **Marginal cost ≈ $0.** Every new listener is pure margin.
- **Defensible library.** Months of curated AI generation = moat new entrants can't replicate overnight.
- **Domain match.** webplay.io = instant comprehension of what it is.
