# 2026-07-09-002 Runtime bridge selector consolidation

## Problem
`src/play/game-engine-bridge/*` still contains many fragmented projection helpers. Several selectors rebuild overlapping runtime facts and then wrap them again into UI-friendly shapes.

## Current hotspots
- `src/play/game-engine-bridge/readRuntimeLineViewsFromGameSave.ts`
- `src/play/game-engine-bridge/readRuntimeLineViewFromDefinition.ts`
- `src/play/game-engine-bridge/readRuntimeCraftViewFromGameSave.ts`
- `src/play/game-engine-bridge/readRuntimeLineOutputViews.ts`
- `src/play/game-engine-bridge/readRuntimeLineOutputViewHelpers.ts`

## Goal
Consolidate fragmented runtime projection into fewer selectors/builders with clearer boundaries.

## Target shape
- fewer thin helper files
- less repeated `save/config/nowMs/effectiveLine` plumbing
- bridge behaves more like selector composition, less like a scattered helper catalog

## Guardrails
- preserve current view outputs
- avoid large folder reorg in this task
- prefer deleting helper files over introducing new wrapper files

## Done when
- one or more bridge helper files disappear
- line/craft/output projection uses fewer cross-file hops
- runtime projection reads more like a selector pipeline than a helper tree
