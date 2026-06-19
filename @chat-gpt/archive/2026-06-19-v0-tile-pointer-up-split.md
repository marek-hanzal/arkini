# v0 TileEngine pointer-up split

Status: completed.

## What changed

`useTilePointerUp.ts` was reduced to pointer-up lifecycle orchestration. Drop finalization details moved to focused flat helpers:

- `createTileDropMotionId.ts`
- `createTileDropHandoffs.ts`
- `runTileDropCommit.ts`
- `runTileDropMotion.ts`

A small `createTileDropHandoffs` unit test documents source/target handoff behavior.

## Guardrails kept

- No public TileEngine API change.
- No nested `tile-engine` folders.
- No Arkini domain imports inside TileEngine.
- `parallel-merge` still commits immediately without snap motion.
- `parallel-swap` still animates peer target when its actor element exists.
- Cancelled drop motion still skips transform reset.
- Commit failure still clears handoff and animates source back.

## Follow-up

Do browser validation before deeper TileEngine cleanup. If TileEngine remains mentally heavy after this, inspect `useTileActorMotion.ts` next. Do not split `TileMotionRuntime.ts` purely because it is long; it is currently a coherent runtime boundary.
