# PR #1 review — chore: repo tooling and CI quality gates (Phase 0 F1, PR 1/2)

2026-07-16, mode: fix (Copilot review)

(package.json) The repo declares Node ">=20", but commitlint 21.x in the
lockfile requires Node >=22.12, so installs/hooks could fail on Node
20–22.11 despite the declared support.

**fixed**
engines.node raised to ">=22.12" to match the strictest tooling
requirement (verified in pnpm-lock.yaml: @commitlint/cli@21.2.1 declares
engines node >=22.12.0).

---

(.nvmrc) Pinning only "22" could allow older 22.x installs inconsistent
with commitlint's >=22.12 requirement.

**fixed**
.nvmrc now pins 22.22.2 (the version used for local dev), which CI also
installs via node-version-file. Satisfies >=22.12 everywhere.

---

(.husky/pre-commit) Hook file is missing a shebang / Husky bootstrap
header.

**declined**
Incorrect for husky v9: core.hooksPath points at .husky/_, and the shim
there (.husky/_/pre-commit, which does have a shebang) sources
.husky/pre-commit as a plain sh fragment — Git never executes our file
directly. The legacy `. "$(dirname -- "$0")/_/husky.sh"` header is
deprecated in v9 and errors under v10, so adding it would create the
breakage the comment is trying to prevent.

---

(.husky/commit-msg) Same shebang/bootstrap comment as pre-commit.

**declined**
Same reasoning as .husky/pre-commit — husky v9 shim architecture makes
the header unnecessary and forward-incompatible.
