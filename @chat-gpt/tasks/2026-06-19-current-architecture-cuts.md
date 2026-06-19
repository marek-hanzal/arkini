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

## Next candidates

1. TileEngine pointer-up phase extraction: split `useTilePointerUp.ts` into behavior-preserving drop finalization helpers without changing the public TileEngine API.
2. Item capability matrix audit: document and validate allowed combinations such as stackable resource, board actor, producer, stash, craft target, removable item.
3. Game engine visual plan audit: split event-family visual mappers only if it reduces mental load without hiding the output-event contract.

Before coding any risky item, inspect source and propose exact files/shape first.
