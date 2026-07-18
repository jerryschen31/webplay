# PR #6 review — feat: edge streaming worker + milestone-0 crossfade playlist

2026-07-17, mode: fix (Copilot review)

(apps/edge-worker/tsconfig.json) lib is ES2022-only, so Worker/fetch
globals aren't provided by lib.

**fixed** (with a correction)
The claim that typecheck "won't pass" was wrong — it passed because
vitest's types transitively pull @types/node's fetch globals. But that
is fragile, so the underlying point stands: added
`"lib": ["ES2022", "WebWorker"]` so the worker types are explicit.

---

(apps/edge-worker/src/index.ts) Preflight lacks
Access-Control-Allow-Headers (Range) and doesn't expose ETag.

**fixed**
CORS headers now include Allow-Headers: Range, If-None-Match and
Expose-Headers: ETag. Test added.

---

(apps/edge-worker/src/index.ts) 405 responses lacked CORS and Allow
headers.

**fixed**
405 now carries CORS + `Allow: GET, HEAD, OPTIONS`. Test updated.

---

(apps/edge-worker/src/index.ts) parseStreamPath accepted any filename
despite the "segments/playlists only" comment.

**fixed**
Regex now requires a .m3u8/.ts/.aac extension, so unrelated bucket
objects can't be served through the route. Tests added (secret.txt,
.wav, .m3u8.bak all rejected).
