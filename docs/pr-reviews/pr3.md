# PR #3 review — feat: ElevenLabs Music adapter + retry/env infrastructure

2026-07-17, mode: fix (Copilot review)

(packages/adapters/src/http.ts) attempts can be 0/negative/non-integer,
so the loop never runs and it throws with lastError undefined.

**fixed**
attempts is now `Math.max(1, Math.floor(...))` — at least one real
request always happens. Test: "clamps a non-positive attempts option".

---

(packages/adapters/src/http.ts) fetchWithRetry overwrites init.signal
with its timeout signal, ignoring caller cancellation.

**fixed**
Caller signal is combined with the timeout via `AbortSignal.any`, and a
caller-initiated abort is rethrown immediately instead of retried.
Tests: "does not retry when the caller's signal aborted", "forwards the
caller's signal to fetch".

---

(packages/adapters/src/http.ts) Retryable responses' bodies are never
consumed/canceled, which can pin undici sockets across retries.

**fixed**
`response.body?.cancel()` before sleeping/retrying. Test: "cancels an
unconsumed retryable response body before retrying".

---

(packages/adapters/src/elevenlabs.ts) provider-controlled request-id
flows into file paths (adapter temp file and CLI dest name) — path
traversal risk.

**fixed**
request-id is only used if it matches `^[A-Za-z0-9_-]{1,128}$`;
otherwise a random UUID is minted. Raw header preserved in
metadata.rawRequestId. Test: "replaces a path-traversal request-id with
a safe generated id".
