# Phase 1 — Feature 4: Build Next.js Frontend with Lofi Channel

## What This Feature Is

The **user-facing web app** at `webplay.io` — a Next.js application deployed on Vercel that presents the Lofi channel with a single, beautiful play button. No signup, no menu navigation, no friction. Click. Hear music. The frontend wires up the Cloudflare HLS stream from Phase 1 Feature 3 to an HTML5 `<audio>` element via `hls.js`, displays now-playing metadata, and renders the page in a way that feels worth opening as a permanent browser tab.

## Why It Matters

- This is what the world sees. The technical magic underneath is invisible if the front door is ugly or slow.
- First-impression bounce rate decides whether we get organic traction.
- A clean, fast, low-friction interface is the actual product.

## Implementation Steps

### 1. Project Setup
- [ ] `apps/web` already scaffolded from Phase 0 — confirm Next.js 15 (App Router) + Tailwind + TypeScript strict.
- [ ] Install: `hls.js`, `framer-motion`, `lucide-react`.
- [ ] Configure `next.config.js` for static export where possible (most pages are static).

### 2. Page Structure (V1 — Lofi Only)
- [ ] `app/page.tsx` — single landing page, no other routes yet.
- [ ] Hero layout:
  - Channel name: **"Lofi Beats for Study"** (large, centered).
  - Subtitle: "AI radio, always on."
  - Giant play/pause button (cycling animation when playing).
  - Now-playing track title (gracefully degrades when unavailable).
  - Live listener count (Phase 2 will wire real data; for now show a sensible faux indicator that's clearly labeled "Listeners online").
  - Visualizer canvas (Phase 1 Feature 5 will fill this; for now a static gradient placeholder).
- [ ] Footer: small "About", "Licensing", "Contact" links — minimal.

### 3. Audio Playback
Create `components/AudioPlayer.tsx`:
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const STREAM_URL = 'https://stream.webplay.io/stream/lofi/playlist.m3u8';

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(STREAM_URL);
      hls.attachMedia(audio);
      return () => hls.destroy();
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = STREAM_URL;  // Safari native
    }
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  };

  return (
    <>
      <audio ref={audioRef} preload="none" />
      <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
    </>
  );
}
```
- [ ] Handle play-promise rejection (autoplay blocked) with a "Click to play" prompt.
- [ ] Spacebar shortcut to toggle play/pause.

### 4. Now-Playing Metadata
- [ ] A tiny Cloudflare Worker route `/api/now-playing/:channel` that reads current track from Postgres (the `tracks` table tracks what Liquidsoap is currently playing via its Telnet API + a sidecar publisher).
- [ ] Frontend polls every 30 seconds with SWR.
- [ ] Gracefully shows "—" if no data available.

### 5. Design Pass
- [ ] Color palette: warm dark mode by default (Lofi vibe). Single accent color (warm orange / dusty rose).
- [ ] Typography: a clean grotesque (Inter, General Sans) for UI; optionally a serif for the channel title.
- [ ] Subtle texture or grain overlay for warmth (CSS noise SVG, 5% opacity).
- [ ] Animations: button breathes when playing, fades when paused.
- [ ] Mobile: vertical layout, play button huge, tap targets ≥44px.

### 6. Performance & SEO
- [ ] Lighthouse target: 95+ on all categories.
- [ ] Preconnect to `stream.webplay.io`.
- [ ] Open Graph + Twitter Card with branded preview image.
- [ ] Static `manifest.webmanifest` so users can "Add to Home Screen".
- [ ] Sitemap + robots.txt.

### 7. Analytics
- [ ] Plausible or PostHog snippet (set up in Phase 0).
- [ ] Track events: `play_clicked`, `pause_clicked`, `session_started`, `session_ended`, `tab_visibility_change`.
- [ ] Avoid tracking PII; no cookies-needed banner if Plausible.

### 8. Accessibility
- [ ] All interactive elements have ARIA labels.
- [ ] Color contrast WCAG AA.
- [ ] Respect `prefers-reduced-motion` — disable visualizer animation if requested.

## Definition of Done
- [ ] `webplay.io` resolves to the Next.js app with sub-1s LCP.
- [ ] One click plays the Lofi stream in Chrome, Safari, Firefox, mobile Safari, mobile Chrome.
- [ ] Now-playing title updates as tracks change.
- [ ] Lighthouse score 95+.
- [ ] 3 random friends look at it and say "ohh, nice."

## Risks
- Autoplay blocked by browser → handled via user gesture (the click), well understood.
- HLS playback bug in some Android browser version → test matrix covers top 5 browsers + iOS/Android.
- Mobile data usage concerns → show "~57 MB/hour" disclosure in the About link.

## Estimated Effort
**4–5 days.** Most time is design polish, not code.
