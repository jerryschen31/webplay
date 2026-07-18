# Phase 0 — Feature 1 status (2026-07-16)

Deviations from [phase0-feature1.md](phase0-feature1.md), agreed with owner.

## Done
- webplay.io active on Cloudflare DNS; stale Squarespace `_domainconnect`
  CNAME removed; DNSSEC enabled (DS applied by Cloudflare Registrar).
- Monorepo tooling: Biome (lint/format), commitlint + husky, .editorconfig,
  strict TS, pnpm workspace (from Feature 2 session A).
- CI: `.github/workflows/ci.yml` — install/build/typecheck/lint/test on
  every PR and pushes to master/build.
- apps/web (Next.js via @opennextjs/cloudflare) live at webplay.io + www,
  auto-deployed by `.github/workflows/deploy-web.yml` on merge.
- GitHub secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.

## Deviations from the notes
- Hosting is Cloudflare Workers, not Vercel (owner decision — one platform,
  token already scoped; edge-worker lands there in Phase 1 anyway).
- Deploy workflows for droplet/edge-worker wait until those apps exist
  (Phase 1).

## Deferred (owner to schedule)
- Social handles (Twitter/X, Bluesky, Instagram, Mastodon, ProductHunt).
- Email forwarding (hello@/legal@/abuse@) via Email Routing.
- Sentry / PostHog / CI failure webhooks — Phase 1, when there's a real app.
- Branch protection: requires GitHub Pro for private repos (API returns
  403 "Upgrade to GitHub Pro"). Options: upgrade, make repo public, or
  continue solo without protection.
- Registrar auto-renew / multi-year renewal: manual dashboard check (API
  token has no Registrar scope).

## Known token gaps (as of 2026-07-16)
- R2 still returns "Authentication error" on bucket list — permission did
  not take effect despite being added; needed by Phase 1. Recheck token in
  dashboard.
