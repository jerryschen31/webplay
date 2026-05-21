# Phase 1 — Feature 6: Internal Launch + Uptime Monitoring

## What This Feature Is

A **structured soft-launch** to ~10 trusted friends and family, during which the full Lofi channel runs 24/7 for at least **one continuous week**. The goal is not marketing — it's stress-testing the whole pipeline (generation → mastering → curation → Liquidsoap → R2 → Worker → browser) under realistic, long-duration use before any public exposure. Pair this with comprehensive uptime monitoring and an on-call alert path so we catch every regression before strangers do.

## Why It Matters

- A 24/7 service has a hundred subtle failure modes that only surface after days of uptime (memory leaks, log volume blowups, edge cases in track files, slow R2 lifecycle bugs).
- Friends will give honest feedback in a way Hacker News commenters won't.
- A clean week of uptime is the prerequisite signal for the public Phase 2 launch.

## Implementation Steps

### 1. Recruit the Cohort
- [ ] Pick 10 people: 3 who'll genuinely use it for study/work, 3 designer/engineer friends who'll critique, 2 "non-techie" friends for first-impression read, 2 people in different time zones (validate global delivery).
- [ ] Brief them: "It's a private alpha for one week. Use it however you'd normally use lofi. Be brutally honest. DM screenshots of anything weird."
- [ ] Set up a private Discord channel for them to drop feedback in real time.

### 2. Uptime Monitoring
- [ ] **UptimeRobot** (free) checks every 1 minute:
  - `https://webplay.io` returns 200.
  - `https://stream.webplay.io/stream/lofi/playlist.m3u8` returns 200 and a non-empty body.
  - Custom script: parses the .m3u8 and confirms the latest segment timestamp is within 20 seconds of now.
- [ ] Notification routes to email + Discord webhook + (optionally) phone SMS.
- [ ] Status page at `status.webplay.io` (e.g., via Better Stack or Vercel-hosted custom page).

### 3. Health Endpoint on the Droplet
- [ ] Sidecar process exposes `:8080/health` returning JSON:
```json
{
  "status": "ok",
  "liquidsoap_uptime_sec": 234567,
  "latest_segment_age_sec": 3,
  "library_depth_hours": 23.4,
  "last_track_played": "lofi-track-12894",
  "errors_last_hour": 0
}
```
- [ ] UptimeRobot hits this endpoint; alerts on any non-ok status or stale segment.

### 4. Application Monitoring
- [ ] **Sentry** wired into the Next.js frontend, the generator worker, and the Cloudflare Worker.
- [ ] Alerts on any error spike or new unique error.
- [ ] **Grafana Cloud free tier** for system metrics: droplet CPU/memory/disk, R2 request volume, Worker request volume + error rate.

### 5. Logging Discipline
- [ ] Centralize droplet logs: `/var/log/webplay/{lofi,generator,uploader}.log`, rotated daily, retained 7 days.
- [ ] Optional: pipe to Better Stack Logs or Axiom (both have free tiers) for searchable retention.
- [ ] Cloudflare Worker logs → Logpush → R2 archive.

### 6. The Week-Long Soak Test
- [ ] Start time: T0.
- [ ] Daily checklist (operator does this each morning):
  - Listen for 5 minutes — anything sound off?
  - Check library depth — still 20–30 hours?
  - Skim curation queue — clear it.
  - Skim error dashboards — investigate anything new.
  - Skim friends' Discord — respond to any issue.
- [ ] Don't deploy any non-critical changes during this week. If something breaks, fix it; otherwise leave it alone and observe.
- [ ] Track every incident in a `docs/soak-test-log.md`: timestamp, symptom, root cause, fix, time to detect, time to repair.

### 7. Define Pass Criteria
- [ ] **Uptime ≥99% over the full week** (you can have ~100 minutes of outage total).
- [ ] **No silent failure**: every issue was caught by automation before a human noticed.
- [ ] **No more than 2 listener-visible regressions** across the cohort.
- [ ] Library replenishment ran autonomously without manual unblocking.
- [ ] Operator daily time spent <15 minutes.

### 8. Post-Soak Retrospective
- [ ] Write a one-page retro: what broke, what surprised, what's safe to scale.
- [ ] Decide: green-light Phase 2 or extend the soak by another week if something major is unresolved.

## Definition of Done
- [ ] 7 consecutive days of ≥99% uptime.
- [ ] All 10 friends successfully streamed for at least one session.
- [ ] All monitoring and alerts demonstrably worked (intentionally break something mid-week to confirm).
- [ ] Soak test log is committed; retro is written.
- [ ] Confidence level on the team: ready for public launch.

## Risks
- A subtle bug only surfaces on day 5 → that's exactly why we soak; fix and reset clock if it's serious.
- Friends are too polite to give real feedback → ask pointed questions ("what's the worst thing about it?").
- Burnout from daily operator chores → automate aggressively before Phase 2 multi-channel makes the workload 5×.

## Estimated Effort
**1 week wall-clock (mostly waiting), ~10 hours of active operator time during the soak.**
