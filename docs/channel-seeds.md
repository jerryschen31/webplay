# Channel seed registry

Known ACE-Step seeds per channel, for reproducing live tracks and rendering
future ones. Seeds condition the RNG only — the caption comes from
`GENRE_PROFILES` in `packages/adapters/src/local.ts`, so a seed only
reproduces a track when the profile caption is unchanged.

Render command (paths must be absolute — the CLI resolves relative paths
against `apps/generator/`):

```
pnpm generate --provider=acestep --genre=<id> --duration=300 --seed=<n> \
  --out=/Users/jerry/gh/webplay/library/<id>/raw
```

## lofi — "Lofi Beats for Study"

- **Live rotation**: 42, 43 (~600s renders, 2026-07-17)
- Note: the live tracks used the warmer caption passed per-run via adapter
  prompt override (see docs/pr-reviews and phase0 notes), later folded into
  the committed profile.

## sleep — "Calm Music for Sleep"

- **Live rotation**: 102, 101, 108 (300s each, 2026-07-18)
- **Approved spare**: 105
- Rendered but not used (owner: "all decent, not for now"): 103, 104, 106, 107

## jazz — "Jazz for Lounging"

- **Live rotation**: 202, 203, 204 (300s each, 2026-07-18)
- **Approved candidates for future tracks** (owner: 15s samples "all very
  good, good variety"): 201, 205, 206 — note a seed's 15s render does not
  fully predict its 300s render; re-listen at full length before shipping.

## cafe — "Cafe for Reading"

- **Live rotation**: 302 (300s, 2026-09-12). The approved WAV has a 3s
  fade-in and 5s fade-out baked in (ffmpeg `afade`, tri curve) so the
  player's end-of-rotation loop is seamless — a one-track rotation gets no
  server-side crossfade. The same track (as MP3) doubles as the gamecafe
  landing-page music.
- **Candidates rendered at 300s**: 301, 303 (raw renders in
  `library/cafe/raw/`, gitignored). Picked by librosa fingerprint: 302 had
  the steadiest loudness envelope (RMS variance 7.6 dB vs 9.0 / 8.7) and the
  lowest percussive share (15.7% vs 16.4% / 22.6%); all three lock to 81 BPM.
