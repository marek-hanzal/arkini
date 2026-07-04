# 2026-07-04 - Producer completion/realtime scope flattening pass

## What changed

Flattened the remaining prop-only producer `Context.Tag` scopes from:

- `src/producer/completeProducerJobFx.ts`
- `src/producer/syncRealtimeProducerJobsFx.ts`

Producer completion now passes explicit completion props through private Fx helpers instead of reading a local `ProducerJobCompletionScopeFx`. Producer realtime sync now passes explicit sync/queue props instead of using local sync and queue Context services.

## Why

Producer completion and realtime sync are high-risk runtime routes: delivery retry, queue timing, paused jobs, active effects, charge depletion, placement, and rescheduling all cross here. Hiding stable props in local Context services made those paths harder to follow without providing real ambient dependency value.

`GameSaveDraftScopeFx` remains in realtime sync because it is a real mutable draft boundary, not a prop-only forwarding layer.

## Current context status after the pass

`Context.Tag` occurrences in `src` dropped from 7 to 4.

Remaining legitimate services:

- `src/config/GameConfigFx.ts`
- `src/save/GameSaveDraftScopeFx.ts`
- `src/random/context/RandomServiceFx.ts`

Remaining cleanup candidate:

- `src/board-memory/applyBoardMemoryActivateFx.ts`
