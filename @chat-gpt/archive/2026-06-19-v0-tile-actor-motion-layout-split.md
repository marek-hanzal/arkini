# Tile actor motion layout split

Status: done on 2026-06-19.

## What changed

`useTileActorMotion.ts` no longer owns both layout motion and imperative drag/drop motion helpers.

New file:

- `src/v0/tile-engine/useTileActorLayoutMotion.ts`

This hook owns only actor layout motion after slot changes plus drop handoff consumption/reset. `useTileActorMotion.ts` remains the public actor motion hook and still returns the same imperative helpers:

- `animateBack`
- `animateToTarget`

## Why

The old hook mixed two different phases:

- passive layout animation when a tile remounts/moves between slots
- imperative reject/snap motion used by drag/drop finalization

Both are legitimate TileEngine concerns, but keeping both inline made the hook harder to scan after the pointer-up split.

## Guardrails

- Public `TileEngine` API stayed unchanged.
- No Arkini domain imports entered `src/v0/tile-engine`.
- No nested folders were introduced.
- `useTileActorMotion.ts` should remain the public actor motion entrypoint; do not make call sites import layout and imperative helpers separately unless there is a clear API reason.
