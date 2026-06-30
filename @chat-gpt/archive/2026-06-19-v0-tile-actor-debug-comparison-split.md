# v0 TileEngine actor debug/comparison split

Status: done on 2026-06-19.

## What changed

- `TileEngineActor.tsx` no longer owns its memo prop comparison inline.
- `TileEngineActor.tsx` no longer owns the verbose feedback debug effect inline.
- Shared active drop feedback equality moved to `sameTileEngineDropFeedback.ts` and is used by `TileEngine`, `TileEngineActor`, and `TileEngineSlot`.
- Actor feedback debug logging moved to `useTileActorFeedbackDebug.ts`.

## Why

`TileEngineActor.tsx` was not architecturally broken, but it mixed rendering/orchestration with memo comparison and debug timeline details. Pulling those out keeps the actor component focused without changing TileEngine behavior or API.

## Guardrails

- Keep TileEngine flat unless a nested folder can strongly defend its domain boundary.
- Do not move Arkini gameplay concepts into TileEngine.
- Do not split `TileMotionRuntime.ts` only because it is long; it is still a coherent runtime boundary.
