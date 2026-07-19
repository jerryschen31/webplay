# Phase 0 Feature 2 — Provider decision (go/no-go)

2026-07-17 · Status: **GO**, with two verification conditions below.

## The V1 generation stack

| role | provider | rationale |
|---|---|---|
| **Primary (all volume)** | **ACE-Step 1.5 turbo, local on M4** | Works on-device (3/3 bench, ~37s warm inference per 30s audio), MIT code+weights, $0 marginal cost, native 10–600s durations covers the 4–5 min track target, owner ear-test positive |
| **Secondary (textures/interludes)** | **Stable Audio Open 1.0, local** | Working on-device; right vibe but weak rhythm (owner ear-test) → percussion-light beds only; 47s ceiling suits interludes; community license OK at our scale |
| **Premium (optional, deferred)** | ElevenLabs Music | Only if the structured listening test shows audible lift for lofi; needs paid plan + written redistribution confirmation; ~$26/mo at 50 tracks |
| **Excluded** | MusicGen (CC-BY-NC), Mubert ($49/mo gate), Suno/Udio (aggregator ToS risk) | licensing/cost/fragility |

This satisfies the feature's core requirement: at least one open-source /
local provider in the final stack as the API-fragmentation hedge — here
it's the *primary*, which is the strongest possible hedge.

## Why this beats the original notes' assumption

The notes guessed "likely Mubert or Eleven Labs Music for primary;
local as filler." Reality inverted it: ElevenLabs-only costs ~5× the
infra budget ($394/mo at full replenishment vs $80 total), Mubert gates
its API behind $49/mo, and local ACE-Step turned out both free and
good-sounding. Local-primary also eliminates the #1 existential risk
the notes identified (API fragmentation).

## Conditions to close before Phase 1 Feature 6 (launch gate)

1. **Licensing paper trail** (docs/provider-licensing.md ⚠️ items):
   ACE-Step variant-repo license inheritance; Stability community
   license streaming/download-resale confirmation.
2. **280s benchmark**: `pnpm bench --provider=acestep --runs=3
   --duration=280` to confirm 4–5 min track wall-clock and memory on
   16GB before scheduling replenishment.

## Still open (not blocking)

- Structured listening test (docs/listening-test.md) to finalize
  per-mood assignments and decide the ElevenLabs premium question.
- Resident-model worker (acestep-api) to amortize the ~3-min cold start
  — Phase 1 Feature 2 scope.
- 24h soak / thermals test — fold into Phase 1 Feature 6 soak week.
