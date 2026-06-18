# Arkini GPT working notes

This repo is now on the runtime tick/action engine path. Treat `RuntimeGameEngineAdapter` + `GameRuntimeStore` as the live gameplay source of truth.

Hard rules for future work:

- Do not revive the removed browser SQLite/Kysely stack. `src/v0/database`, `dbFx`, `withTransactionFx`, migrations, SQL row projections and database status UI are gone on purpose.
- Do not add React Query back into gameplay runtime. Board, inventory, item, upgrade and debug runtime UI read through `useGameRuntimeSelector` / focused hooks from `src/v0/play/runtime`.
- Do not add gameplay `useMutation` hooks. If an action changes `GameSave`, add or reuse a typed engine action and dispatch through the runtime adapter/store.
- The engine lives under `src/v0/game/engine`. It must not import React, TileEngine, Dexie, browser storage, UI, or app shell code. It receives config/save/action/time and returns save/events.
- Persistence is future outer plumbing. When storage returns, it should load `GameSave`, create/wrap `RuntimeGameEngineAdapter`, subscribe to changes and persist the save. Storage must adapt to the runtime save shape, not the other way around.
- TileEngine remains generic. `src/v0/tile-engine` must not import Arkini domains such as board, inventory, play, manifest, item, activation, craft, upgrade, database/storage or game.
- Before each non-trivial task, check whether existing libraries already cover the need. Do not write in-house machinery just because humans enjoy inventing tiny cursed wheels.

Current architectural state:

- Static rules compile into validated `GameConfig` JSON under `game/arkini.game.json`.
- Runtime save state is the `GameSave` document owned by `RuntimeGameEngineAdapter`.
- React uses `GameRuntimeStore` with `useSyncExternalStore` selectors.
- Visual events are derived from engine domain events under `src/v0/play/game-engine-bridge` and registered into TileEngine motion from `GameRuntimeVisualEffects`.
- Dev scenarios replace the runtime save directly.
- Browser hard reset is a generic browser-storage wipe plus reload, not a SQL database reset.

Active follow-up after the SQLite removal pass:

1. Run full local validation with dependencies: `npm run typecheck`, `npm run dc`, `npm run game:validate:default`, `npm run test`, `npm run build`.
2. Continue runtime parity audit around remaining sheet actions and debug flows.
3. Add Dexie/IndexedDB only after runtime parity is stable, and keep it outside the engine.
