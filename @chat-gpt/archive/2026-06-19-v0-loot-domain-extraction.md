# v0 loot domain extraction

Status: done.

Moved loot/random roll helpers out of `src/v0/game/engine/fx` into top-level `src/v0/game/loot`.

Files moved:

- `rollGameQuantityFx.ts`
- `rollWeightedLootTableEntryFx.ts`
- `rollLootTableItemsFx.ts`

Reason: loot rolling is a game domain used by producer/stash output flows. It is not engine orchestration and should not live in the engine Effect megabucket.

No behavior change intended.

Next likely engine slimming cuts:

- board/inventory action helpers
- merge/remove
- config layer/effective config service
