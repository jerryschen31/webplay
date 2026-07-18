# PR #7 review — feat: lofi web player with background art

2026-07-17, mode: fix (Copilot review)

(apps/web/components/AudioPlayer.tsx) The `ended` loop handler calls
audio.play() without handling rejection — a blocked replay would be an
unhandled promise rejection and leave the button showing "playing".

**fixed**
Replay rejection now resets the playing state:
`audio.play().catch(() => setPlaying(false))`.
