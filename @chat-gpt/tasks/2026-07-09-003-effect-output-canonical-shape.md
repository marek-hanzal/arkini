# 2026-07-09-003 Effect output canonical shape

## Problem
Effect-derived output summaries are still assembled in multiple places with partially overlapping logic.
This keeps code volume high and spreads the explanation of "what the effect changed" across craft, producer and bridge code.

## Current hotspots
- `src/effects/readEffectiveOutputEntries.ts`
- `src/play/game-engine-bridge/readRuntimeEffectOperationSummary.ts`
- `src/play/game-engine-bridge/readRuntimeLineOutputViews.ts`
- `src/craft/readCraftLineEffectState.ts`
- `src/world/readWorldActiveEffectFacts.ts`

## Goal
Introduce or converge on one canonical post-effect output/bonus shape that downstream readers can reuse.

## Guardrails
- do not change authored config semantics
- do not fold unrelated world facts into the effect summary
- only do this after drop chain and bridge passes unless there is an obvious low-risk simplification

## Done when
- downstream code consumes one shared post-effect shape more directly
- duplicated effect-summary assembly shrinks
- at least one helper or translation layer disappears
