# Phase 1 — Feature 3: Cloudflare R2 + Worker Edge Delivery Layer

> **Revision 2026-07-17**:
> - The account API token already has R2 + Workers permissions
>   (verified); GitHub secrets CLOUDFLARE_API_TOKEN / ACCOUNT_ID are
>   set, and deploys follow the existing deploy-web.yml pattern.
> - Use `wrangler.jsonc` (not wrangler.toml) to match apps/web.
> - `apps/edge-worker` should reuse the repo's existing conventions:
>   Biome, vitest, strict TS from tsconfig.base.json.
> - This Worker is needed by Feature 1's new Milestone 0 (pre-rendered
>   playlist), so build it before/alongside the droplet work.

## What This Feature Is

The **public-facing distribution layer** that turns webplay.io into a global-scale radio station. A Cloudflare Worker sits at the edge, fetches `.m3u8` playlists and `.aac` segments from Cloudflare R2 object storage, and serves them to every listener's browser. Because R2 has **zero egress fees** and Workers are cached at every Cloudflare PoP, this layer handles 5 listeners or 50,000 listeners for essentially the same cost (~$0–$5/mo at our scale).

## Why It Matters

- This is the architectural piece that makes the unit economics work. Without it, bandwidth bills scale linearly with listeners and the business model collapses.
- Decouples the droplet from all listener traffic — the droplet stays at ~zero load no matter how viral we go.
- Gives us global low-latency delivery for free (Cloudflare has 300+ PoPs).

## Implementation Steps

### 1. R2 Bucket Setup
- [ ] Create R2 bucket `webplay-stream` (separate from `webplay-library`).
- [ ] Bucket structure:
  ```
  webplay-stream/
    lofi/
      playlist.m3u8
      seg-1234.aac
      seg-1235.aac
      ...
  ```
- [ ] Enable Cloudflare R2's automatic lifecycle policy: delete objects older than 5 minutes (segments are ephemeral; the droplet uploader keeps a rolling window).
- [ ] Generate R2 API token (read+write) for the droplet uploader.

### 2. Cloudflare Worker
- [ ] `apps/edge-worker/src/index.ts`:
```ts
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const match = url.pathname.match(/^\/stream\/([a-z0-9-]+)\/(.+)$/);
    if (!match) return new Response('Not found', { status: 404 });

    const [, channel, file] = match;
    const obj = await env.STREAM_BUCKET.get(`${channel}/${file}`);
    if (!obj) return new Response('Not found', { status: 404 });

    const isPlaylist = file.endsWith('.m3u8');
    return new Response(obj.body, {
      headers: {
        'Content-Type': isPlaylist ? 'application/vnd.apple.mpegurl' : 'audio/aac',
        'Cache-Control': isPlaylist
          ? 'public, max-age=2, must-revalidate'
          : 'public, max-age=300, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
```
- [ ] Bind R2 bucket to Worker via `wrangler.toml`.
- [ ] Deploy with `wrangler deploy`.

### 3. Custom Domain Routing
- [ ] Route `stream.webplay.io/*` to the Worker via Cloudflare DNS + Workers route binding.
- [ ] Confirm public URLs like `https://stream.webplay.io/stream/lofi/playlist.m3u8` resolve.

### 4. Cache Tuning
- [ ] Verify HIT rate via Cloudflare Analytics — target >95% for `.aac` segments, >50% for `.m3u8` (it changes often).
- [ ] If `.m3u8` cache hit rate is too low, consider Cache API with explicit 2-second TTL in the Worker.
- [ ] **CRITICAL:** never let `.m3u8` cache stale — listeners would all fetch deleted segments and hear silence. Short `max-age` + `must-revalidate` is the safe default.

### 5. CORS
- [ ] `Access-Control-Allow-Origin: *` on all responses so `hls.js` in arbitrary browsers can fetch.
- [ ] Preflight OPTIONS handler if any non-simple headers are added later.

### 6. Rate Limiting (Light)
- [ ] Cloudflare WAF rule: rate-limit by IP at 1000 req/min — far above what a legit listener needs (~15 req/min), low enough to deter scrapers.
- [ ] Document an allowlist mechanism for the B2B creator-licensing tier (those streams may have higher per-IP request rates).

### 7. Observability
- [ ] Worker logs to Cloudflare Logpush → S3 / R2 for cost-effective archival.
- [ ] Daily metrics: total requests, cache hit ratio, error rate, top channels by request volume.
- [ ] Alert if error rate >1% over 5 min window.

### 8. Smoke Tests
- [ ] `curl https://stream.webplay.io/stream/lofi/playlist.m3u8` returns 200 + valid m3u8 body.
- [ ] `ffplay https://stream.webplay.io/stream/lofi/playlist.m3u8` plays continuous audio.
- [ ] Open the URL in 5 different browsers simultaneously → all hear the **exact same audio at the same time** (synchronized stream).
- [ ] Use `webpagetest.org` to confirm time-to-first-audio is <2 seconds from cold cache.

## Definition of Done
- [ ] `https://stream.webplay.io/stream/lofi/playlist.m3u8` works publicly.
- [ ] Cache hit rate >90% on segments per Cloudflare Analytics.
- [ ] Load test with 1,000 concurrent simulated listeners shows zero droplet CPU spike (droplet stays at <5% load).
- [ ] Worker monthly cost projected <$5 even at 10× current request volume.

## Risks
- Cloudflare changes R2 egress pricing → migrate stream bucket to Bunny Storage (similar pricing model).
- Listeners on captive portals / corp networks blocking HLS → web frontend gracefully shows a "stream blocked" message and offers fallback.
- DDoS on the stream → Cloudflare's standard DDoS protection covers this for free.

## Estimated Effort
**2–3 days.** Worker code is small; tuning cache + verifying behavior at scale is most of the work.
