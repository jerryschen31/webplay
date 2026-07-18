# PR #9 review — feat: unique segment prefix per hls rotation build

2026-07-17, mode: fix (Copilot review)

(apps/generator/src/hls.ts) defaultSegmentPrefix() had minute
resolution, so two builds in the same minute would reuse a prefix and
reintroduce the cache-mixing risk.

**fixed**
Prefix is now the millisecond epoch (`r${Date.now()}`).
