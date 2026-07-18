# Idea: rotating background art with crossfade

Owner idea, 2026-07-17.

The site background (currently a single static image,
`apps/web/public/backgrounds/lofi-beats-1.jpg`) should slowly rotate
through a pool of channel-matched artwork — **a new image every ~15–20
minutes, with a gentle fade-out / fade-in transition** — so a tab left
open all day keeps feeling alive without being distracting.

Assets: three images already optimized in
`apps/web/public/backgrounds/` (originals in repo-root `images/`,
untracked). Pool grows over time; could eventually be AI-generated per
channel to match the audio mood.

Implementation sketch (when picked up, likely alongside
phase1-feature5's visualizer work since both animate the backdrop):
- Client component holding an index into a shuffled image list;
  `setInterval` at 15–20 min (randomized within the band to avoid
  metronomic switches).
- Two stacked absolutely-positioned layers; fade via CSS
  `transition: opacity ~2s` — load the next image in the hidden layer
  first (`new Image()` preload) so the fade never reveals a half-loaded
  frame.
- Respect `prefers-reduced-motion`: either no rotation or a hard cut.
- Pause rotation when `document.visibilityState === "hidden"` (no work
  in background tabs); switch on next visibility instead.
- Later: per-channel image pools keyed by the active channel; sponsor
  skinning hook could reuse the same layer system (see
  notes/phase1-feature5.md §7).
