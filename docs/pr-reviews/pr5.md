# PR #5 review — docs: phase 0 feature 2 close-out

2026-07-17, mode: fix (Copilot review)

(notes/phase1-feature3.md) Revision block says wrangler.jsonc but the
implementation steps still said "Bind R2 bucket via wrangler.toml".

**fixed**
Inline step updated to wrangler.jsonc (matching apps/web).

---

(notes/phase1-feature2.md) Revision block moves the generator worker to
the M4 and calls BullMQ overkill, but §1 still described deploying on
the droplet with BullMQ/Redis.

**fixed**
§1 rewritten to match: worker on the M4/Mac Mini, SQLite/D1 job table +
cron for V1, BullMQ only if generation goes multi-machine.
