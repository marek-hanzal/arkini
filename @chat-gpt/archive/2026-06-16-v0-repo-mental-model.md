# v0 repo mental model

Arkini v0 is now a client-only runtime-engine app. The live game state is not SQL rows and not a React Query cache. It is the `(GameConfig, GameSave)` pair owned by `RuntimeGameEngineAdapter` and exposed to React through `GameRuntimeStore` selectors.

## Boundaries

- `src/v0/game/engine` is standalone gameplay logic. It uses Effect internally, receives data, returns data and domain events. It must not import React, TileEngine, browser storage, Dexie or app shell code.
- `src/v0/play/runtime` is the React-facing runtime wrapper: `GameRuntimeProvider`, `GameRuntimeStore`, selectors and runtime action hooks.
- `src/v0/play/game-engine-bridge` converts engine save/config/events into UI-facing board/inventory/item/upgrade views and visual events.
- `src/v0/tile-engine` is generic DnD/motion infrastructure. It knows geometry and animation, not Arkini rules.
- `src/v0/debug` reads runtime diagnostics and scenarios from the runtime store.

## Removed on purpose

The old browser SQLite/Kysely stack has been deleted: no `src/v0/database`, no `dbFx`, no `withTransactionFx`, no SQL migrations, no database status React Query path, no gameplay query cache bridge.

Do not reintroduce this as a “temporary helper”. Temporary helpers are how bugs obtain citizenship.

## State rules

1. Gameplay reads use `useGameRuntimeSelector` or focused hooks like `useGameBoardView`, `useGameInventoryView`, `useGameItemView`, `useGameUpgradeListView`.
2. Gameplay writes dispatch typed engine actions through `useGameAction`, `useGameRuntimeDropActions`, or direct `GameRuntimeStore.dispatch/tick/replaceSave` when a dev tool needs it.
3. Visual motion subscribes to runtime update events and should not patch a separate cache.
4. Persistence, when added, wraps the adapter from outside and stores `GameSave` snapshots. It must not leak into engine functions.
