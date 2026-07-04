# 2026-07-04 - Producer start scope flattening pass

## What changed

Flattened prop-only `Context.Tag` scopes from producer line start flow:

- `src/producer/checkLineStartReadinessFx.ts`
- `src/producer/startLineFx.ts`

Both files now pass explicit scope props through private Fx helpers instead of using local Effect context services only to move stable `{ config, save, action, nowMs }` / checked readiness data around.

## Why

Producer start is a high-frequency gameplay route. Local prop-only services made the route harder to grep and mentally follow without providing real ambient dependency value.

## Current context status after the pass

`Context.Tag` occurrences in `src` dropped from 9 to 7.

Remaining legitimate services:

- `src/config/GameConfigFx.ts`
- `src/save/GameSaveDraftScopeFx.ts`
- `src/random/context/RandomServiceFx.ts`

Remaining cleanup candidates:

- `src/producer/completeProducerJobFx.ts`
- `src/producer/syncRealtimeProducerJobsFx.ts` (two local scopes)
- `src/board-memory/applyBoardMemoryActivateFx.ts`
