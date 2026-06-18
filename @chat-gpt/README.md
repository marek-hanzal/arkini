# Arkini GPT working notes
- 2026-06-18: Arkini raw runtime store pass removed derived board/inventory/items from runtime store; source of truth is now raw engine snapshot plus selector-derived views.

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
- Visual effects are planned directly from engine domain events under `src/v0/play/game-engine-visual` and registered into TileEngine motion/transients from `GameRuntimeVisualEffects`. The old `ActionVisualEvent` bridge is gone.
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


GameConfig / tick engine stabilization checkpoint:

- Current `main` has been checkpointed into branch `v0`; continue normal work on `main`.
- `@chat-gpt/v0/v0-game-config-tick-engine-brutal-review-2026-06-18.md` is the raw audit. `@chat-gpt/v0/v0-stabilization-epic-2026-06-18.md` is the corrected implementation epic after Marek clarified craft/inventory/overlay semantics.
- T1 is done in `@chat-gpt/v0/v0-craft-single-job-invariant-2026-06-18.md`: craft start/readiness and save validation enforce max one running craft job per target item.
- T2 is done in `@chat-gpt/v0/v0-craft-target-replacement-2026-06-18.md`: completed craft replaces the target item in-place with one result and removed the old craft output/return scheduled-spawn path.
- T2 visual follow-up is done in `@chat-gpt/v0/v0-craft-replace-crossfade-2026-06-18.md`: craft replacement now uses TileEngine `replace-in` / `replace-out` crossfade motion with an old-item board transient.
- T3 is done in `@chat-gpt/v0/v0-stash-atomic-output-2026-06-18.md` plus `@chat-gpt/v0/v0-stash-full-open-output-2026-06-18.md`: stash open applies all remaining output in one atomic batch, places sequentially like producer, depletes in one click and fails without partial mutation if the whole batch does not fit.
- Side quest is done in `@chat-gpt/v0/v0-craft-partial-input-withdraw-2026-06-18.md`: craft targets persist partial input progress in `save.craftInputs`, start only after inputs are complete, lock inputs on start, and allow pre-start single-unit withdraw through producer-style seeded placement.
- T4 is done in `@chat-gpt/v0/v0-effective-upgrade-validation-2026-06-18.md`: `GameConfigSchema` rejects effective upgrade prefixes that make product duration/input quantities/producer queue size invalid, and config layer building no longer clamps bad values.
- T5 is done in `@chat-gpt/v0/v0-product-input-scope-hardening-2026-06-18.md`: product definitions and product input refs are now owned by exactly one producer/product line, including effective `product.inputRef.set` prefixes; config layering resolves product input overrides through an explicit input-ref owner map.
- T6 is done in `@chat-gpt/v0/v0-inventory-stateless-stack-policy-2026-06-18.md`: inventory save slots now distinguish stateless stacks from preserved item instances; stateful board items stash as one-slot inventory instances, running-job actors reject stash, and placement/consumption/view helpers respect instance quantity/state. T7 is done in `@chat-gpt/v0/v0-generated-entity-ids-2026-06-18.md`: save-level ID counters are gone, and runtime-created item/job/scheduled-event IDs use `genId`/cuid2 with domain prefixes.

Current task candidates:

1. Event flow cleanup / visual planner hardening.
2. Badge/visual polish can wait; tiny UI cosmetics do not outrank save/model stabilization, no matter how shiny the little badge feels.

See `@chat-gpt/v0/README.md` for the v0-specific task index.


Raw subscription/cache cleanup checkpoint:

- 2026-06-18: Next mental-load reduction task is documented in `@chat-gpt/v0/v0-raw-subscription-state-task-2026-06-18.md`. Direction: prefer authoritative runtime snapshot + focused `useSyncExternalStore` selectors over manual board/inventory cache patching. Cache is only acceptable as safe selector memoization or transient visual state; gameplay truth belongs to `GameSave` snapshots.

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

- Merge/interactions are explicit source-owned `GameConfig` rules. `resolveExecutableItemMergeRule` must only resolve rules from `sourceItem.mergeIds`; it must not synthesize reverse merges from target-owned rules.
- `water -> twig` is authored on `item:water` as `merge:water-twig-sprout`; `twig -> water` is not a merge unless `item:twig` gets its own explicit rule.
- `consumeSource: false` imprint rules stay directed. Reverse-directed imprint drops may reject before swap, but they must not become executable merges.


Touch / long-press polish checkpoint:

- TileEngine surfaces suppress native `contextmenu` and iOS touch callout/tap highlight so long-press game gestures are not hijacked by the browser.
- Keep this scoped to game interaction surfaces. Do not prevent context menus globally across ordinary app UI unless there is a very specific reason.

Board DnD confinement checkpoint:

- Board item DnD is board-only. Board items can move, swap, merge and interact with board cells/items, but inventory is no longer a board-item drop target.
- The bottom inventory nav button must stay a normal button, not a `TileEngineDropTarget`.
- `DropActions` should not expose board-item stash for DnD plumbing.
- Moving a board item into inventory is an explicit `Store` action from the item detail sheet, dispatching `board.item.stash`.

Stash atomic output checkpoint:

- `stash.open` must apply its rolled output directly through `placeGameSaveItemsFx`; it must not schedule output just to get sequential animation.
- If stash output placement is unavailable, `stash.open` fails with `board:full` / `inventory:full` via `GamePlacementFailed` and the original save remains unchanged.
- Depleted stashes are handled immediately by `applyStashDepletionFx`: `remove` deletes the board item and runtime state; `replaceWithItemId` changes the same item instance and clears runtime state.
- `GameSaveScheduledEventSchema` currently allows only `item.spawn`; scheduled board remove/replace events were removed because they were stash animation plumbing, not real delayed domain state.

Inventory seeded placement checkpoint:

- Long-pressing an empty board cell opens inventory in placement mode with that cell as placement seed.
- Double-tapping a stack in that mode dispatches `inventory.item.place` with `placementMode: "nearest_by_manhattan"` and `quantity: 1`. It places one item from the stack around the selected seed cell, keeps the inventory sheet open after success, and behaves like normal repeated inventory access rather than one-shot select-and-close. Single tap must not place items.
- Normal inventory double-tap and explicit inventory-to-board DnD remain exact single-item placement. Do not replace those with nearest-cell behavior unless the UX explicitly changes.
- TileEngine stays generic: slots only expose optional `onLongActivate`; Arkini board/inventory adapters attach the placement meaning outside the engine.

Product-line input ref checkpoint:

- Producer-level consumable inputs are gone from the live model. Producer shells can have requirements/product lines, but only product lines own consumable production inputs.
- `GameConfig.inputs` is a top-level named input definition record. Products reference those records via `products.*.inputRefId`; use `readProductInputs({ config, productId })` instead of reading product-local inputs.
- `producer.input.store` fills the first enabled product line, in `producer.productIds` order, that accepts the dragged item and has capacity. Shared inputs therefore resolve top-to-bottom by enabled line state.
- Product line UI displays its own input rows/readiness. Filling still happens through core DnD/merge-like interaction onto the producer tile, not a special button.
- Product line input rows with stored quantity can withdraw the whole stored amount at once. Withdraw uses producer-style board-then-inventory placement seeded at the producer tile and rejects without state changes if no placement is available.
- `GameSaveConfigSchema` validates `save.producerInputs` against effective product input refs, including completed `product.inputRef.set` upgrades.

- 2026-06-18: Placement capacity failures now use `GamePlacementFailed` tagged errors with concrete `board:full` / `inventory:full` / `placement-failed:unknown` reasons; low-level placement helpers fail through Effect and action/domain callers catch/map them. See `@chat-gpt/v0/v0-placement-failure-reasons-2026-06-18.md`.
- 2026-06-18: Effective upgrade validation is now schema-owned. `product.duration.add`, `product.input.quantity.add` and `producer.maxQueueSize.add` may not produce zero/negative runtime values, and input quantity upgrades must stay within capacity. See `@chat-gpt/v0/v0-effective-upgrade-validation-2026-06-18.md`.
- 2026-06-18: T8 event flow cleanup is done. `ActionVisualEvent` / `play/visual-events` / `play/tile-engine-motion` runtime dialects were removed; `GameEvent[]` now maps directly to `GameEngineVisualPlan` motion/transient instructions. See `@chat-gpt/v0/v0-event-flow-visual-planner-2026-06-18.md`.
