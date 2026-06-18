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


Working-notes layout:

- Root `@chat-gpt/README.md` is the current high-level map. Keep it short and current.
- v0-specific task notes and historical logs live under `@chat-gpt/v0/`. Do not dump new v0 task files into the root.
- Epic-style/backlog task groups may live in dedicated subfolders such as `@chat-gpt/000-refactor-backlog/`; the `000-*` shape is optional, not a law handed down by an angry markdown god.

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

Current task candidates:

1. Touch/long-press polish: suppress native context/callout only on game interaction surfaces.
2. Inventory-to-board seeded placement: reuse the shared Manhattan placement planner for long-press empty-cell placement.
3. Badge/visual polish: tighten tile badge offset toward the corner without redesigning the tile.

See `@chat-gpt/v0/README.md` for the v0-specific task index.

Dexie destructive refresh checkpoint:

- Prototype storage compatibility is intentionally coarse. If a Dexie save record has a stale storage schema version, stale save document version, mismatched game id/config hash or invalid `GameSave` payload, `DexieGameSaveStorage.loadActiveSave` wipes the whole save database and returns `null`.
- `createPersistentGameRuntimeStore` then creates and persists a fresh initial save. Do not add partial IndexedDB migrations while the v0 save shape is still moving quickly.
- Recoverable Dexie schema open/upgrade errors are treated the same way: drop the Dexie database and retry the operation against a fresh schema.

GameSave schema validation checkpoint:

- Save validation is centralized through `GameSaveConfigSchema`, a Zod schema for `{ save, config }` that sits in the game engine model/schema layer.
- `GameSaveSchema` owns raw document shape; `GameSaveConfigSchema.superRefine` owns config-aware invariants such as board bounds/unique cells, inventory slot count/max stack sizes, producer queue caps including completed queue upgrades, job target references, stash/stored requirement state, upgrade progress and scheduled event references.
- Dexie storage receives `config` and calls `GameSaveConfigSchema` on load/save. Invalid semantic save state is wiped through the existing drop-and-fresh policy.
- Do not scatter save invariant checks into storage, React runtime, UI views or feature modules. Those layers may perform action-readiness/user-intent checks, but persisted save integrity belongs to the schema layer.

Stored requirements runtime checkpoint:

- Stored requirements live in `save.storedRequirements[targetItemInstanceId].items` and are validated centrally by `GameSaveConfigSchema`.
- Producer/stash readiness gates against stored quantities on the target board item; store/withdraw actions modify the same save bucket.
- Stored requirements must be filled through the core drag/drop + merge-like tile interaction model, not through special `Store` buttons or bespoke form UI. Drag matching items onto the building/target tile.
- Product line views expose `requirementsReady` and `missingRequirementItemIds`; blocked product lines should describe the DnD requirement path, not trigger special storage UI.
- Current runtime drop routing prioritizes missing stored requirements before producer/stash consumable inputs. If an item is both a durable requirement and a consumable input, the requirement fills first; after capacity is full, normal input actions can run.
- Do not move this into storage/UI validation. UI flags are readiness hints; save integrity stays schema-owned.

DnD interaction contract checkpoint:

- `resolveDropIntent` is the central board-target interaction contract for merge-like DnD decisions. Keep board hover feedback, board drop actions and inventory-to-board drop acceptance aligned with it.
- Missing stored requirements are accepted as merge-like interactions and should show merge feedback, not blocked feedback.
- Priority after reverse-directed merge rejection is: regular merge, missing stored requirement, craft input, activation/producer/stash input, swap. Runtime dispatch mirrors the durable-before-consumable part after regular merge.
- Product-line `missingRequirementItemIds` is only a DnD readiness hint. Disabled product lines must not make their requirements droppable.


Local placement planner checkpoint:

- `planEmptyBoardCellsFx` is the shared board placement planner. Without `seedCell`, it preserves top-to-bottom / left-to-right scan order. With `seedCell`, it orders empty cells by Manhattan distance from the seed with scan order as deterministic tie-break.
- Producer, stash and craft completion preflight placement now pass their source/target board cell as seed. Scheduled spawn processing derives the same seed from `originItemInstanceId`, so delayed output still lands around its source while the source exists.
- Inventory-to-board long-press placement should reuse this planner instead of creating a second near-cell search.

Producer blocked delivery checkpoint:

- Producer output rolls once. If placement is unavailable, the rolled output is persisted under `producerJobs[jobId].delivery.items`; retries deliver that same payload instead of rerolling.
- Pending delivery keeps the producer job alive and therefore keeps consuming queue capacity. A package stuck in the doorway is still occupying the slot.
- Blocked delivery retries via `delivery.retryAtMs` and does not spam `product.blocked` events after the first block.
- Runtime board view exposes `activation.deliveryBlocked`; board cells map it to a subtle generic danger frame.
- `placeGameSaveItemsFx` is the current placement reservation layer. It mutates a cloned save as each item is placed, so same-tick producer completions reserve distinct cells against the latest placement state.

DnD feedback frame checkpoint:

- Do not add labels/tooltips/special UI for DnD affordances. Visual feedback should stay in-frame and subtle.
- TileEngine exposes only generic feedback variants (`subtle`, `primary`, `secondary`, `danger`). Domain layers map Arkini meanings onto those variants.
- Stored requirement fill uses primary/blue frame feedback; craft/producer/stash consumable input uses secondary/green frame feedback. Regular merge should rely on the existing merge animation rather than extra colored frames.
- Keep hover feedback and post-success board-cell pulses aligned so the thing previewed during drag matches what flashes after commit.
- Do not reduce existing hover scale just to make feedback subtle. Subtle means frame/border/glow intensity, while scale should remain clearly visible.


Producer board progress checkpoint:

- Running producer jobs now show the existing subtle bottom progress bar directly on the board tile.
- Board producer progress is active-work-only: future queued jobs and completed blocked deliveries do not show as running progress. Blocked delivery continues to use the subtle danger frame.

Merge executable parity checkpoint:

- Regular combo merges are executable item pairs and work from either drag direction. `consumeSource: false` imprint rules stay directed and reverse-directed drops reject instead of swapping.
- `resolveExecutableItemMergeRule` is the shared source for runtime merge readiness, DnD drop intent/actions and item catalog merge relations. Do not reintroduce raw source-only `mergeIds` scans for executable behavior.
- Regression target: `item:twig` + `item:water` must resolve to `item:sprout` from both drag directions.


Product-line input ref checkpoint:

- Producer-level consumable inputs are gone from the live model. Producer shells can have requirements/product lines, but only product lines own consumable production inputs.
- `GameConfig.inputs` is a top-level named input definition record. Products reference those records via `products.*.inputRefId`; use `readProductInputs({ config, productId })` instead of reading product-local inputs.
- `producer.input.store` fills the first enabled product line, in `producer.productIds` order, that accepts the dragged item and has capacity. Shared inputs therefore resolve top-to-bottom by enabled line state.
- Product line UI displays its own input rows/readiness. Filling still happens through core DnD/merge-like interaction onto the producer tile, not a special button.
- `GameSaveConfigSchema` validates `save.producerInputs` against effective product input refs, including completed `product.inputRef.set` upgrades.
