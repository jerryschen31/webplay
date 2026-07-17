# PR #4 review — feat: local model adapters + bench harness

2026-07-17, mode: fix (Copilot review)

(apps/generator/py/acestep_generate.py) Script falls back to os.getcwd()
for project_root while the Node adapter defaults to
~/.webplay/models/ACE-Step-1.5 — the two can disagree.

**fixed**
The adapter now passes --project-root explicitly (single source of
truth); the script requires a valid directory and exits 2 otherwise.

---

(apps/generator/src/benchlib.ts) toCsv replaced double quotes with
single quotes — corrupts data, not valid CSV escaping.

**fixed**
RFC 4180 escaping: embedded quotes doubled inside quoted fields;
newlines still flattened for the error column. New unit test asserts
the escaped form.

---

(packages/adapters/test/local.test.ts, two comments) Fixed filenames in
os.tmpdir() can collide across concurrent vitest workers.

**fixed**
Both fixtures now live in a per-process mkdtemp directory.
