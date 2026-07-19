# Environment variables

Configuration is read from a local `.env` file at the repo root. **`.env`
and every `.env.*` file are gitignored and must never be committed** — this
document replaces the old `.env.example` template. Copy the names below into
your own `.env` and fill in the values.

## Cloudflare (webplay.io zone)

Account-owned API token. Needs: Zone DNS Edit, Worker Routes Edit, Account
Workers Scripts Edit; Phase 1 additionally needs Account Workers R2 Storage
Edit.

| Variable | Notes |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account id (token is verified against `/accounts/{id}/tokens/verify`). |
| `CLOUDFLARE_ZONE_ID` | webplay.io zone id. |
| `CLOUDFLARE_API_TOKEN` | Bearer token used by the HLS uploader (`pnpm hls --upload`) and Workers deploys. |

## Auth — Kinde (email magic-link)

Unused until Phase 1.

| Variable | Notes |
| --- | --- |
| `KINDE_DOMAIN` | |
| `KINDE_CLIENT_ID` | |
| `KINDE_CLIENT_SECRET` | |

## Providers

| Variable | Notes |
| --- | --- |
| `ELEVENLABS_API_KEY` | ElevenLabs Music — paid plan required for commercially licensed output. |
| `MUBERT_*` | Mubert API (deferred: $49/mo gate). |
| `AGGREGATOR_API_KEY` | 302.ai / APIframe for Suno & Udio (deferred). |

## Local model generation

For the local adapters (`packages/adapters/src/local-models.ts`).

| Variable | Notes |
| --- | --- |
| `HF_TOKEN` | Hugging Face token; required for the gated `stabilityai/stable-audio-open-1.0` weights (free account; accept the model license first). |
| `ACESTEP_PROJECT_DIR` | Checkout of https://github.com/ACE-Step/ACE-Step-1.5 (defaults to `~/.webplay/models/ACE-Step-1.5`); run `uv sync` in it once. |
| `ACESTEP_VARIANT` | Model variant (default `acestep-v15-turbo`). Set `acestep-v15-base` to engage the slower non-turbo quality path where guidance/steps take effect. |
| `ACESTEP_KEYSCALE` | Override the genre key, e.g. `"C Major"` / `"Am"` (defaults come from the genre profile; lofi = C Major). |
| `ACESTEP_BPM` | Override the target BPM (lofi default 75). |
| `ACESTEP_INFERENCE_STEPS` | Diffusion steps (script default 8 = turbo; use 32–100 with `acestep-v15-base` for cleaner harmony/timing). |
| `ACESTEP_GUIDANCE_SCALE` | CFG strength (script default 7.0; non-turbo only). |
| `MUSICGEN_MODEL_SIZE` | `small`\|`medium` (default `small`; benchmark only, CC-BY-NC weights). |
