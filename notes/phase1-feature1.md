# Phase 1 — Feature 1: Stand Up Liquidsoap Droplet with HLS Output

> **Revision 2026-07-17**:
> - **New Milestone 0 (do first, no droplet):** pre-render each
>   channel's rotation offline — ffmpeg `acrossfade` (~3–4s) between
>   consecutive approved tracks, chop to HLS segments, upload playlist +
>   segments to R2, serve via the Feature 3 edge Worker. This gets
>   webplay.io audibly streaming with zero new infrastructure and
>   de-risks the HLS/Worker/player chain before Liquidsoap exists.
>   Loses live scheduling only; replaced when the droplet lands.
> - The R2-scoped API token already works (verified 2026-07-17); create
>   buckets `webplay-library` and `webplay-stream` when starting this.
> - Deploy workflow for the droplet config joins `.github/workflows/`
>   next to the existing ci.yml / deploy-web.yml (base branch flow:
>   PRs target `build`).

## What This Feature Is

Provisions the **always-on audio engine** — a small DigitalOcean droplet running **Liquidsoap** that continuously shuffles the Lofi seed library, crossfades tracks, and emits a rolling stream of **4-second HLS .aac segments** plus a `.m3u8` playlist index. These segments are then uploaded to Cloudflare R2 (Phase 1 Feature 3 handles delivery). This droplet is the "private kitchen" — no listener ever connects directly.

## Why It Matters

- This is the **only stateful, always-on component** in the architecture. If it dies, the radio dies.
- Liquidsoap is rock-solid open-source software that has powered internet radio since 2003. It handles edge cases (missing files, codec hiccups, crossfades) gracefully.
- The 4-second HLS chunking is what unlocks free CDN egress and infinite scale — done right, this single $12 droplet supports millions of listeners.

## Implementation Steps

### 1. Provision the Droplet
- [ ] Create a **DigitalOcean droplet**: Basic tier, 1 vCPU / 1 GB RAM / 25 GB SSD, Ubuntu 24.04 LTS, ~$6/mo. Pick a region close to your generator worker (NYC or SFO).
- [ ] Add the deploy SSH key from Phase 0.
- [ ] Set hostname `webplay-engine-01`.
- [ ] Enable automatic security updates.
- [ ] UFW firewall: allow only SSH (22) from your IPs + outbound HTTPS to R2.

### 2. Install Liquidsoap
- [ ] Use the official Savonet APT repo (Ubuntu packages tend to be old):
  ```bash
  curl -fsSL https://savonet.github.io/opam-bin-repo/install.sh | bash
  apt install liquidsoap ffmpeg
  ```
- [ ] Pin a known-good version (e.g., 2.2.5) — note in `apps/liquidsoap/VERSION`.
- [ ] Verify with `liquidsoap --version`.

### 3. Sync the Library Locally
- [ ] Install `rclone` and configure for Cloudflare R2.
- [ ] Cron job every 30 minutes: `rclone sync r2:webplay-library/lofi/approved /var/lib/webplay/lofi --transfers=4`.
- [ ] Local cache keeps disk usage modest (~3 GB for 20 hours of AAC).
- [ ] Track newly-added/removed files so Liquidsoap can pick them up on next reload.

### 4. Liquidsoap Configuration
Create `apps/liquidsoap/lofi.liq`:
```liquidsoap
# Source: the local Lofi library, shuffled, reload-on-change
lofi_source = playlist(
  mode="randomize",
  reload=300,
  reload_mode="rounds",
  "/var/lib/webplay/lofi"
)

# 4-second crossfade between tracks
lofi_source = crossfade(duration=4., lofi_source)

# Normalize loudness as a safety net
lofi_source = normalize(lofi_source)

# Output to HLS — 4-second segments, rolling window of 6
output.file.hls(
  playlist="lofi.m3u8",
  segment_duration=4.,
  segments=6,
  segments_overhead=2,
  [("aac_64k", %ffmpeg(format="mpegts", %audio(codec="aac", b="128k", ac=2, ar=44100)))],
  "/var/lib/webplay/hls/lofi"
)
```

### 5. Systemd Service
Create `/etc/systemd/system/webplay-lofi.service`:
```ini
[Unit]
Description=webplay Lofi Liquidsoap engine
After=network.target

[Service]
ExecStart=/usr/bin/liquidsoap /opt/webplay/lofi.liq
Restart=always
RestartSec=5
User=webplay
StandardOutput=append:/var/log/webplay/lofi.log
StandardError=append:/var/log/webplay/lofi.log

[Install]
WantedBy=multi-user.target
```
- [ ] `systemctl enable --now webplay-lofi.service`
- [ ] Verify `.m3u8` and `.aac` files appearing in `/var/lib/webplay/hls/lofi/`.

### 6. Upload Segments to R2
- [ ] Lightweight watcher script (Node or Go) using `inotify` to detect new `.aac` and updated `.m3u8` files.
- [ ] On change: `aws s3 cp` (with R2 endpoint) the file to `r2://webplay-stream/lofi/`.
- [ ] Set cache headers correctly: `.aac` files = `public, max-age=86400, immutable`; `.m3u8` = `public, max-age=2, must-revalidate` (it changes constantly).
- [ ] Delete segments older than 60 seconds from R2 to keep storage tight.

### 7. Health Checks & Monitoring
- [ ] Cron every minute: confirm `.m3u8` mtime is fresh (within 10s). If stale, alert via Discord webhook + auto-restart Liquidsoap.
- [ ] Liquidsoap exposes a Telnet/HTTP admin interface — wire its metrics to a tiny exporter for Grafana Cloud free tier.
- [ ] Set up UptimeRobot to hit a tiny `/health` HTTP endpoint served by a sidecar on port 8080.

### 8. Failure Modes Tested
- [ ] Kill `liquidsoap` process → systemd should restart within 5s.
- [ ] Delete the entire R2 segments folder → uploader should backfill within ~30s.
- [ ] Reboot droplet → stream auto-resumes on boot.
- [ ] Network blip on R2 upload → uploader retries with exponential backoff.

## Definition of Done
- [ ] Liquidsoap is running 24/7 under systemd.
- [ ] A fresh `.aac` segment lands in R2 every ~4 seconds.
- [ ] `playlist.m3u8` in R2 is always within 6 seconds of real-time.
- [ ] You can play `https://r2-public-url/lofi/playlist.m3u8` in VLC and hear continuous, gapless Lofi audio for 30+ minutes without artifacts.
- [ ] Killing the process triggers an alert and auto-recovery within 10s.

## Risks
- Liquidsoap config bug causes silence → keep a watcher that checks output amplitude, alerts on prolonged silence.
- Disk fills up with stale segments → log rotation + segment TTL enforced.
- DigitalOcean networking outage → document Hetzner / Vultr fallback recipe.

## Estimated Effort
**3–4 days.** Bulk of time is tuning Liquidsoap crossfade and HLS settings to sound truly seamless.
