# Provider licensing — Phase 0 Feature 2

Verified 2026-07-17. ⚠️ = needs written confirmation from the provider
before launch (Phase 1 Feature 6 gate). Sources: Hugging Face model
metadata (`cardData.license`), provider APIs exercised this week, and
provider pricing pages.

## Summary table

| provider | commercial streaming | redistribution of output | resale (downloads tier) | cost/track (3–4 min) | verdict |
|---|---|---|---|---|---|
| ACE-Step 1.5 (local) | ✅ MIT code AND weights (`ACE-Step/Ace-Step1.5` tagged `mit` on HF) | ✅ | ✅ | ~$0 | **primary** |
| Stable Audio Open 1.0 (local) | ✅ under Stability AI Community License while revenue < $1M/yr ⚠️ | ✅ within license | ⚠️ verify | ~$0 | **secondary (textures)** |
| MusicGen (local) | ❌ weights CC-BY-NC-4.0 (HF-confirmed) | ❌ | ❌ | — | **benchmark only, never in rotation** |
| ElevenLabs Music | ❌ on free tier (API returns 402 `paid_plan_required`, verified); paid plans include commercial license ⚠️ verify redistribution for radio | ⚠️ | ⚠️ | ~$0.45–0.60 ($0.15/min) | deferred; optional premium tier |
| Mubert | API access $49/mo minimum (owner declined) | per-tier | per-tier | n/a | parked |
| Suno / Udio (via 302.ai/APIframe) | no official API; aggregator ToS risk | ❓ | ❓ | n/a | parked |

## Detail & open questions

**ACE-Step 1.5** — code MIT (GitHub), weights repo `ACE-Step/Ace-Step1.5`
tagged MIT on Hugging Face. Cleanest possible posture: no revenue caps,
no attribution requirement, output ownership rests with us.
⚠️ Individual variant repos (e.g. `acestep-v15-turbo-shift3`) carry no
explicit license tag — confirm they inherit the umbrella MIT before
launch (open a GitHub issue asking, keep the reply).
Training-data provenance is undisclosed (typical for the category) —
noted as an accepted risk in the decision doc.

**Stable Audio Open 1.0** — gated weights under the Stability AI
Community License: free commercial use while annual revenue < $1M;
above that, an enterprise license is required. Well under our horizon.
⚠️ Confirm two points against the current license text before launch:
(1) 24/7 public streaming counts as ordinary commercial use, (2) selling
individual downloads is permitted. Their license page is the source of
record; if ambiguous, email Stability.

**MusicGen** — weights are CC-BY-NC-4.0 (confirmed via HF metadata).
Output cannot enter a monetized stream. The adapter hard-codes
`licenseTerms: "restricted"`; the Phase 1 generator worker must refuse
to publish restricted tracks (enforce in the publish job, not by
convention).

**ElevenLabs Music** — free tier cannot call the Music API at all
(verified live: HTTP 402). Paid tiers include a commercial license;
⚠️ verify the current Music API terms cover redistribution in an
ad-supported/subscription radio stream, in writing, before any EL track
airs. At $0.15/min, EL-only generation is ~$337/mo at our replenishment
rate — see cost model.

**Aggregators (302.ai / APIframe)** — parked. If revisited: never make
an aggregator-backed provider primary for any channel (notes/phase0-
feature2.md risk list), and re-verify Suno/Udio ToS at that time.
