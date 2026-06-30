# v0 engine fx removal

Completed the `src/v0/game/engine/fx` cleanup.

Moved config overlay/service pieces into `src/v0/game/config`:

- `applyConfigLayerFx.ts`
- `buildConfigLayerFx.ts`
- `buildGameConfigServiceFx.ts`
- `GameConfigFx.ts`
- `GameConfigLayer*Schema.ts`

Moved save bootstrap/helpers into `src/v0/game/save`:

- `createInitialGameSaveFx.ts`
- `cloneGameSaveFx.ts`
- `createGameItemInstanceIdFx.ts`

Moved remaining orchestration files directly into `src/v0/game/engine`:

- `applyGameActionFx.ts`
- `parseGameActionFx.ts`
- `readActionReadinessFx.ts`
- `runGameTickFx.ts`

`src/v0/game/engine/fx` was removed. Do not recreate a top-level architecture bucket based on implementation style. Effect-based files should live in their domain (`producer`, `craft`, `placement`, `config`, `save`, etc.) or in `engine` only when they are real cross-domain orchestration.
