# 2026-07-09-002 Runtime bridge selector consolidation

## Problem
`src/play/game-engine-bridge/*` still contains a few large projection builders that mix domain-derived facts with UI shaping.
The worst remaining hotspot is `readRuntimeLineOutputViews.ts`.

## Current hotspots
- `src/play/game-engine-bridge/readRuntimeLineOutputViews.ts`
- `src/play/game-engine-bridge/readRuntimeLineViewFromDefinition.ts`
- `src/play/game-engine-bridge/readRuntimeCraftViewFromGameSave.ts`

## Goal
Make bridge projection thinner by consuming more canonical effect/output data directly and by deleting bridge-only reconstruction logic when possible.

## Target shape
- bridge reads like selector composition
- less repeated `lootPlan -> output views` plumbing
- fewer bridge-local helpers for things that belong to `effects`

## Guardrails
- preserve current view outputs
- avoid folder reorg in this task
- prefer deleting bridge-specific helpers over adding new bridge wrapper layers

## Done when
- `readRuntimeLineOutputViews.ts` is materially smaller or simpler
- at least one bridge-local reconstruction step disappears
- craft + line view consume shared output/effect shape more directly

## Progress
- removed thin runtime reader catalog and several bridge wrappers earlier in this pass series
- moved bonus summary generation from bridge into `effects/readEffectiveLineBonusEntries.ts`
- removed `readRuntimeEffectOperationSummary.ts`
- next step: reduce bridge-local loot/output reconstruction around `readRuntimeLineOutputViews.ts`

- `readRuntimeLootDropViewsFromEffectiveLine.ts` now consumes canonical `readEffectiveLootPlanViewEntries(...)` instead of rebuilding visible/chance/weighted traversal inside the bridge.
- `readRuntimeLineOutputViews.ts` no longer re-sorts output entries after canonical view-entry ordering and no longer carries `sourceIndex` through an extra bridge-local wrapper type.
- removed single-use bridge wrappers `readRuntimeLineJobs.ts` and `readRuntimeLineStartRequirementsReady.ts` by inlining them into `readRuntimeLineViewFromDefinition.ts`.
- `readRuntimeLineInputViewState.ts` now computes per-input available/stored/required facts once instead of re-reading available quantities during readiness checks.
