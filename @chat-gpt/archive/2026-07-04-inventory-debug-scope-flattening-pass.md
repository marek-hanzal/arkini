# 2026-07-04 inventory/debug scope flattening pass

Follow-up senior deep review pass after `9e56944c`.

## Changes

- Removed prop-only local `Context.Tag` scopes from inventory board placement:
  - `checkInventoryItemPlaceReadinessFx`
  - `placeInventoryItemOnBoardFx`
  - `placeGameSaveInventoryRemainderFx`
- Removed prop-only local scopes from item spawn job and tile removal readiness:
  - `processItemSpawnJobFx`
  - `checkTileRemoveReadinessFx`
- Removed prop-only local debug scopes:
  - `checkDebugItemSpawnReadinessFx`
  - `spawnDebugItemFx`
- Fixed a duplicated `liveSlot` object property in `placeInventoryItemOnBoardFx` while flattening the dispatch.
- Kept real ambient context services intact: config, save draft, random, and larger stateful orchestration scopes that need a separate pass before flattening.

## Validation notes

- `src/**/logic`: still 0.
- `Context.Tag` occurrences in `src`: reduced from 28 before the prior pass, to 21 after this pass.
- `format:check`, `audit:current`, `audit:dead`, `audit:dupes`, `game:schema:check`, `game:validate -- game/arkini`, `dc`, `typecheck`, and `build` passed.
- Full monolithic Vitest run again hit sandbox timeout while printing passing tests. Targeted changed-area tests passed: debug spawn, item spawn jobs, remove, placement, board inventory, board memory.
