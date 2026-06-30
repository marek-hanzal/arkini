# v0 game engine visual plan split

Status: done on 2026-06-19.

## Goal

Reduce mental load in `createGameEngineVisualPlan.ts` without changing the GameEvent contract or turning visual planning into gameplay logic.

## Result

`createGameEngineVisualPlan.ts` now only orchestrates ordered `GameEvent` interpretation and skip handling for merge pairs.

Event-family helpers own the visual mapping details:

- `appendItemCreatedVisuals.ts`
- `appendItemMergeVisuals.ts`
- `appendItemReplaceVisuals.ts`
- `findMergeResultEventIndex.ts`

Small naming helpers own group/cause derivation:

- `createGameVisualCreatedGroupId.ts`
- `createGameVisualMergeSourceTileId.ts`
- `readGameVisualCreatedCause.ts`

Mutable plan shape lives in `GameEngineVisualPlanDraft.ts`.

## Guardrails

- `GameEvent` remains an output-now contract from the engine.
- Visual planning must map engine output to motion/transient-tile requests only.
- Do not add placement, readiness, inventory, or gameplay decisions here.
- Inventory quantity visual handling is intentionally explicit no-motion for now.
- Do not split `GameEventSchema` just for line count; it is an intentional output-event contract unless it starts carrying behavior.
