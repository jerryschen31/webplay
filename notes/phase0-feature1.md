# Phase 0 — Feature 1: Lock Domain, Set Up Repo & CI/CD

## What This Feature Is

Establishes the foundational infrastructure scaffolding for the entire project. This means securing the `webplay.io` domain, creating the source code repository with sensible defaults (linting, formatting, conventional commits), and wiring up a continuous integration pipeline that will catch regressions automatically from day one. Without this in place, every subsequent feature ships on shaky ground.

## Why It Matters

- **Reputation:** Domain ownership protects the brand before launch buzz attracts squatters.
- **Velocity:** Good CI from the start means we never have to retrofit it later under time pressure.
- **Discipline:** Conventional commit + lint enforcement keeps the codebase tidy as it grows.

## Implementation Steps

### 1. Domain
- [ ] Confirm `webplay.io` is registered and renewals are set to auto-renew for 5 years.
- [ ] Add domain to a dedicated DNS provider (Cloudflare DNS) for free DNSSEC + fast propagation.
- [ ] Set up email forwarding (`hello@webplay.io`, `legal@webplay.io`, `abuse@webplay.io`) via Cloudflare Email Routing.
- [ ] Reserve matching handles on Twitter/X, Bluesky, Instagram, Mastodon, ProductHunt.

### 2. Repository Structure
- [ ] Create monorepo at `github.com/<user>/webplay` with directories:
  - `apps/web` — Next.js frontend
  - `apps/generator` — AI music generator worker (Node or Python)
  - `apps/liquidsoap` — Liquidsoap config + Dockerfile for the droplet
  - `apps/edge-worker` — Cloudflare Worker for serving HLS
  - `packages/adapters` — pluggable AI provider adapters
  - `infra/` — Terraform or shell scripts for droplet provisioning
- [ ] Add root-level `pnpm-workspace.yaml` (or `turbo.json`) for monorepo orchestration.
- [ ] `.gitignore` covers `node_modules`, `.env*`, `*.mp3`, `*.aac`, `*.m3u8`, `.DS_Store`.

### 3. Tooling Defaults
- [ ] **TypeScript** strict mode across all TS packages.
- [ ] **Biome** or **ESLint + Prettier** with shared config in `packages/config-eslint`.
- [ ] **Conventional Commits** enforced via `commitlint` + Husky pre-commit hook.
- [ ] **Changesets** for versioning if we ever publish packages.
- [ ] `.editorconfig` for cross-editor consistency.
- [ ] `.nvmrc` pinning Node version (e.g., 20 LTS).

### 4. CI/CD (GitHub Actions)
- [ ] `.github/workflows/ci.yml` runs on every PR:
  - Install deps with frozen lockfile.
  - Type-check all packages.
  - Lint all packages.
  - Run unit tests (Vitest).
  - Build all packages.
- [ ] `.github/workflows/deploy-web.yml` — auto-deploys `apps/web` to Vercel on merge to main.
- [ ] `.github/workflows/deploy-worker.yml` — deploys `apps/edge-worker` via Wrangler on merge.
- [ ] `.github/workflows/deploy-droplet.yml` — SSH-deploys Liquidsoap config to droplet via GitHub OIDC.
- [ ] Branch protection on `main`: require passing CI + 1 approval (for solo dev, can be self-approve).
- [ ] Secrets configured in repo: `CLOUDFLARE_API_TOKEN`, `VERCEL_TOKEN`, `DO_SSH_KEY`, `SUNO_API_KEY`, `UDIO_API_KEY`.

### 5. Observability Hooks (Pre-wired)
- [ ] Sentry project created; DSN added to all three apps (web, generator, worker).
- [ ] PostHog or Plausible project created; key in env vars.
- [ ] Discord / Slack webhook configured for CI failures + alerts.

## Definition of Done
- [ ] PR merged to main triggers full CI green and deploys a "hello world" Next.js page at `webplay.io`.
- [ ] Pushing a broken commit shows a red CI badge within 5 minutes.
- [ ] All secrets stored in GitHub Secrets, never in repo.

## Estimated Effort
**2–3 days** for a solo developer working evenings.
