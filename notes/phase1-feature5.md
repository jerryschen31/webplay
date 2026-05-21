# Phase 1 — Feature 5: Audio-Reactive Visualizer

## What This Feature Is

A **mesmerizing, audio-reactive visual element** on the homepage that turns webplay.io from "a play button on a page" into "a thing you leave open on a monitor for hours." Uses the Web Audio API to analyze the live stream's frequency data and drives a 2D canvas (or WebGL shader) that pulses, breathes, and morphs in sync with the music. This is the single biggest contributor to time-on-site and the canvas on which premium ad/sponsor real estate is sold in later phases.

## Why It Matters

- Lofi listeners famously leave tabs open all day. The visualizer is what makes them keep webplay open instead of YouTube's lofi girl loop.
- It's the primary differentiator versus "just another web radio site."
- It is the monetization surface for Tier 1 ads (Phase 3).

## Implementation Steps

### 1. Audio Analysis Plumbing
- [ ] Hook the `<audio>` element from Phase 1 Feature 4 into an `AudioContext`:
```ts
const ctx = new AudioContext();
const source = ctx.createMediaElementSource(audioEl);
const analyser = ctx.createAnalyser();
analyser.fftSize = 1024;
source.connect(analyser);
analyser.connect(ctx.destination);
```
- [ ] Read frequency data on each animation frame: `analyser.getByteFrequencyData(dataArray)`.
- [ ] Smooth across frames (rolling average) so visuals don't twitch on transients.

### 2. Visualizer V1 — "Warm Breathing Orb" (Canvas 2D)
- [ ] Centered glowing orb that scales with bass energy (`dataArray[0..16]`).
- [ ] Concentric rings ripple outward driven by midrange (`dataArray[64..256]`).
- [ ] Subtle particle field in the background that drifts with treble (`dataArray[300..500]`).
- [ ] Color palette: warm dusty oranges + soft purples (matches Lofi aesthetic).
- [ ] Implemented in `<canvas>` with `requestAnimationFrame`.
- [ ] **Target frame rate: 60fps on mid-tier 2020 hardware; 30fps acceptable on mobile.**

### 3. Performance Considerations
- [ ] Pause `requestAnimationFrame` when tab is hidden (`document.visibilityState === 'hidden'`).
- [ ] Cap DPR (device pixel ratio) at 2 — canvas at native 4K is 8× the GPU work for marginal visual win.
- [ ] Profile in Chrome DevTools; main-thread CPU stays <8% during playback.
- [ ] Mobile: lower particle count, lower FFT resolution.

### 4. `prefers-reduced-motion` Support
- [ ] If user has `prefers-reduced-motion: reduce`, replace the animated visualizer with a static gradient + a single subtle pulse on bass beats only.
- [ ] Detected via `window.matchMedia` + re-checked on change.

### 5. Visualizer V2 — Optional WebGL Variant
- [ ] (Stretch) Add a second visualizer style: a Perlin-noise flow field rendered via a WebGL fragment shader, audio-reactive.
- [ ] Toggle between V1 (canvas) and V2 (shader) via a discreet UI control in the corner.
- [ ] Persist user preference in `localStorage`.

### 6. Visualizer "Off" Mode
- [ ] A static, gorgeous illustration / looping cinemagraph for users who find motion distracting.
- [ ] Three options: Orb (default), Shader, Off.

### 7. Sponsor Hook (Future-Proofing)
- [ ] Architect the visualizer container so a sponsor can later "skin" it: custom color palette, custom particle texture, branded watermark in a corner.
- [ ] Spec a `VisualizerTheme` interface even though we don't need it in V1 — keeps the door open for Phase 3 monetization without a rewrite.

### 8. QA & Polish
- [ ] Watch the visualizer for a full 30-minute session at multiple times of day. Note any visual fatigue / annoyance and tune amplitude curves.
- [ ] Test in fullscreen mode (`F11`) — should feel immersive.
- [ ] Test with screen-sharing (Zoom, Meet) — confirm capture works (helps virality of "share my screen during deep work" use case).
- [ ] Confirm no memory leak over 4-hour idle session (Performance > Memory snapshot).

## Definition of Done
- [ ] Visualizer renders at 60fps on a modern laptop.
- [ ] Visually responds to bass, mid, and treble in noticeable but tasteful ways.
- [ ] CPU stays <10% on a 2020 MacBook Air.
- [ ] Three modes available: Orb / Shader / Off.
- [ ] `prefers-reduced-motion` honored.
- [ ] You can leave it running for 4 hours without crashes, slowdowns, or visual fatigue.

## Risks
- WebGL not supported on some users → canvas 2D mode is the universal fallback.
- Audio Context blocked until user gesture → tied to the play click, so this is fine.
- Visualizer triggers seizures (epilepsy) → no fast strobing; verify against WCAG 2.3.1 flash thresholds.

## Estimated Effort
**4–6 days.** Most time is iterative design polish to find something that's mesmerizing rather than annoying.
