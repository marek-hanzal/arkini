# Arkini GPT working notes

This repo is now on the runtime tick/action engine path. Treat `RuntimeGameEngineAdapter` + `GameRuntimeStore` as the live gameplay source of truth.

Hard rules for future work:

- Do not revive the removed browser SQLite/Kysely stack. `src/v0/database`, `dbFx`, `withTransactionFx`, migrations, SQL row projections and database status UI are gone on purpose.
- Do not add React Query back into gameplay runtime. Board, inventory, item, upgrade and debug runtime UI read through `useGameRuntimeSelector` / focused hooks from `src/v0/play/runtime`.
- Do not add gameplay `useMutation` hooks. If an action changes `GameSave`, add or reuse a typed engine action and dispatch through the runtime adapter/store.
- The engine lives under `src/v0/game/engine`. It must not import React, TileEngine, Dexie, browser storage, UI, or app shell code. It receives config/save/action/time and returns save/events.
- Persistence is outer plumbing. Dexie loads `GameSave`, `createPersistentGameRuntimeStore` creates/wraps `RuntimeGameEngineAdapter`, subscribes to runtime updates and persists the full save snapshot. Storage adapts to the runtime save shape, not the other way around.
- TileEngine remains generic. `src/v0/tile-engine` must not import Arkini domains such as board, inventory, play, manifest, item, activation, craft, upgrade, database/storage or game.
- Before each non-trivial task, check whether existing libraries already cover the need. Do not write in-house machinery just because humans enjoy inventing tiny cursed wheels.

Current architectural state:

- Static rules compile into validated `GameConfig` JSON under `game/arkini.game.json`.
- Runtime save state is the `GameSave` document owned by `RuntimeGameEngineAdapter`.
- React uses `GameRuntimeStore` with `useSyncExternalStore` selectors.
- Visual events are derived from engine domain events under `src/v0/play/game-engine-bridge` and registered into TileEngine motion from `GameRuntimeVisualEffects`.
- Dev scenarios replace the runtime save directly.
- Browser hard reset wipes Dexie save storage first, then best-effort OPFS/local/session storage and reloads. It is not a SQL database reset.
- Producer queue size is now a config/runtime invariant. `producers.*.maxQueueSize` caps running+queued jobs per producer item instance; upgrades can adjust it through `producer.maxQueueSize.add`.
- Runtime snapshots expose the effective config for the current save. `adapter.config` remains the immutable base config; `adapter.readSnapshot().config` is the layered config UI should read.


Recent runtime parity checkpoint:

- Live UI time is shared through `useLiveNowMs`. Use it for countdown/progress UI that should move without engine revisions.
- `useGameRuntimeSelector` cache now keys on both runtime root snapshot and selector identity, so time/prop-driven selectors can recompute correctly.
- Scheduled event blocks are retried after `blockedScheduledEventRetryDelayMs` instead of leaving `dueAtMs` in the past and hot-looping the auto ticker.
- Debounced Dexie persistence flushes on pagehide/hidden as a best-effort safety net.

Recent GameConfig hardening checkpoint:

- `GameConfigSchema` now rejects duplicate authoring codes, duplicate producer product IDs, duplicate activation/craft inputs, duplicate activation requirements, duplicate item tags/merge IDs, item definitions that point at non-item assets, and activation/stored requirement capacities below required quantity.
- Dedicated schema tests cover starting-state invariants plus these semantic authoring guards.
- Keep using `parseGameConfig` as the shared CLI/runtime gate. Do not add a second validator that drifts into another tiny religion.

Active follow-up after the SQLite removal pass:

1. Storage/schema version migration policy for Dexie saves: save version, config hash mismatch, reset vs migrate vs repair.
2. Continue runtime parity audit around remaining sheet actions and debug flows.
3. Keep Dexie/IndexedDB outside the engine while adding any future persistence niceties.
