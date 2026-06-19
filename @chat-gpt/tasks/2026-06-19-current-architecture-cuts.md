# Current architecture cuts

Status: active task queue for the current cleanup/refactor block.

## Done in this block

- `2026-06-19`: item-to-board-item interaction planner unified.
- `2026-06-19`: action readiness/apply dispatch and basic readiness checks tightened.
- `2026-06-19`: effective config overlay contracts covered by tests.
- `2026-06-19`: `@chat-gpt` notes reorganized into `tasks/`, `backlog/`, `archive/`.
- `2026-06-19`: persistence retry safety fixed; failed writes keep latest pending save.
- `2026-06-19`: board read-model bridge split into focused activation/craft/item readers.
- `2026-06-19`: reverted `GameSaveSchema` validation split; schema core contracts are not line-count cleanup targets.
- `2026-06-19`: split future work from now-events; old delayed item-spawn records are now `itemSpawnJobs`.
- `2026-06-19`: job/event follow-up checked active notes/source naming; active rules now say scheduled/pending means job, event means now/output.
- `2026-06-19`: removed obsolete `src/v0/manifest` TS manifest tree and moved runtime ID schemas to `game/config`.
- `2026-06-19`: completed v0 line-count/topology audit; TileEngine is the main future complexity cluster.
- `2026-06-19`: completed TileEngine complexity audit; next safe cut is `useTilePointerUp.ts` phase extraction.
- `2026-06-19`: split `useTilePointerUp.ts` drop finalization into focused motion/commit/handoff helpers.
- `2026-06-19`: split `useTileActorMotion.ts` layout motion into `useTileActorLayoutMotion.ts`.
- `2026-06-19`: split `TileEngineActor.tsx` memo comparison and feedback debug effect into focused helpers.

## Next candidates

1. Item capability matrix audit: document and validate allowed combinations such as stackable resource, board actor, producer, stash, craft target, removable item.
2. Game engine visual plan audit: split event-family visual mappers only if it reduces mental load without hiding the output-event contract.
3. TileEngine follow-up audit: next likely targets are `TileEngineSlot.tsx` long-press extraction or `createGameEngineVisualPlan.ts` visual-family audit. Validate TileEngine changes in browser before deeper motion runtime cleanup. Do not split `TileMotionRuntime.ts` just for line count.

Before coding any risky item, inspect source and propose exact files/shape first.
