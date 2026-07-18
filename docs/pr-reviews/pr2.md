# PR #2 review — feat: hello world at webplay.io with auto-deploy (Phase 0 F1, PR 2/2)

2026-07-16, mode: fix (Copilot review)

(.github/workflows/deploy-web.yml) Workflow has no `permissions` block, so
GITHUB_TOKEN gets repository-default permissions — broader than a job that
only checks out code needs.

**fixed**
Added `permissions: contents: read` to deploy-web.yml, and applied the
same block to ci.yml (same least-privilege reasoning; landing it here
rather than reopening PR #1).
