# 2026-07-09-003 Effect output canonical shape

## Problem
Effect-derived output summaries are still assembled in multiple places with partially overlapping logic.
This keeps code volume high and spreads the explanation of "what the effect changed" across craft, producer and bridge code.

## Current hotspots
- `src/effects/readEffectiveOutputEntries.ts`
- `src/effects/readEffectiveLineBonusEntries.ts`
- `src/play/game-engine-bridge/readRuntimeLineOutputViews.ts`
- `src/play/game-engine-bridge/readRuntimeCraftViewFromGameSave.ts`
- `src/craft/readCraftLineEffectState.ts`

## Goal
Converge on one canonical post-effect output/bonus shape that downstream readers can reuse directly.

## Guardrails
- do not change authored config semantics
- do not fold unrelated world facts into the effect summary
- do not create new bridge-only wrapper layers

## Done when
- downstream code consumes one shared post-effect shape more directly
- duplicated effect-summary assembly shrinks
- at least one helper or translation layer disappears

## Progress
- moved line bonus entry and benefit summary generation from `play/game-engine-bridge` into `effects/readEffectiveLineBonusEntries.ts`
- removed `readRuntimeEffectOperationSummary.ts` bridge helper layer
- line view and line output readers now consume the shared effects-level bonus shape directly
- reduced craft output flow so it passes shared `grantIds` once and feeds `readRuntimeLineOutputViews` directly from `lootPlan`, removing the fake craft-only `EffectiveLine` wrapper
- next step: introduce a shared `EffectiveLootPlan` path so craft/runtime/completion stop rebuilding the same loot-plan object manually
