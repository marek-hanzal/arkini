# Game engine domain topology audit

Status: completed for `engine/fx` cleanup. `applyGameActionFx.test.ts` was split by domain family; producer, craft, stash, placement, requirements, upgrade, job, loot, board/inventory, merge, remove, config, and save helpers were moved to top-level game domains without behavior changes. `src/v0/game/engine/fx` was removed; action/readiness/tick orchestration now lives directly in `src/v0/game/engine`.

## Problem

`src/v0/game/engine/fx` is currently grouped by implementation style: “this file is an Effect”. That is not a domain boundary.

The flat structure was useful while stabilizing the engine, but `fx/` now has 100+ files with unrelated workflows next to each other: action dispatch, readiness, placement, producer, craft, stash, upgrades, jobs, config overlay, loot, IDs, and low-level readers.

This creates navigation load. The engine is not conceptually one giant `fx` domain; it is multiple domain workflows using Effect.

## Current source shape

- `src/v0/game/engine/fx`: started at 111 files; now removed after domain extraction and final orchestration flattening.
- `src/v0/game/engine/model`: 68 files.
- `src/v0/game/engine/runtime`: 3 files.
- `src/v0/game/engine/logic`: 4 files.
- `src/v0/game/engine/context`: removed; `GameConfigFx` lives in `game/config`.

Big tests are also domain-mixed:

- `fx/applyGameActionFx.test.ts`: ~2282 lines, covers producer, stash, craft, stored requirements, remove, merge, placement, board/inventory.
- `fx/runGameTickFx.test.ts`: ~565 lines, mostly producer/craft tick behavior.
- `fx/upgradeFx.test.ts`: ~582 lines, upgrade lifecycle and config effects.

## Domain groups visible in `fx/`

### Engine entry / orchestration

- `applyGameActionFx.ts`
- `readActionReadinessFx.ts`
- `parseGameActionFx.ts`
- `runGameTickFx.ts`
- `buildGameConfigServiceFx.ts`

These are shell/orchestration files. They may import many domain workflows, but should not contain domain rules themselves.

### Config overlay / effective config

- `buildConfigLayerFx.ts`
- `applyConfigLayerFx.ts`
- `buildGameConfigServiceFx.ts`

This is its own domain: base config + save upgrades -> effective config.

### Placement / board and inventory placement primitives

Moved to `src/v0/game/placement/`:

- `placeGameSaveItemsFx.ts`
- `placeSingleGameSaveItemRequestFx.ts`
- `placeGameSaveInventoryItemsFx.ts`
- `placeGameSaveInventoryInstanceFx.ts`
- `placeGameSaveInventoryRemainderFx.ts`
- `placeInitialInventoryItemFx.ts`
- `placeInventoryItemOnBoardFx.ts`
- `planEmptyBoardCellsFx.ts`
- `findFirstEmptyBoardCellFx.ts`

`createInitialGameSaveFx.ts` remains engine/bootstrap orchestration and imports placement. Placement is now a shared game domain, not engine-owned Effect plumbing.

### Board/inventory movement

Moved to `src/v0/game/board/`, `src/v0/game/inventory/`, and `src/v0/game/placement/`:

- `moveBoardItemFx.ts`
- `swapBoardItemsFx.ts`
- `swapInventorySlotsFx.ts`
- readiness files for those actions
- `readBoardItemCell.ts`
- `removeBoardItemRuntimeState.ts`
- `readBoardItemRuntimeStateStatus.ts`

Board runtime-state cleanup/status helpers live in `game/board` because they are shared by stash, craft, requirements, merge, and remove.

### Merge domain

Moved to `src/v0/game/merge/`:

- `mergeItemFx.ts`
- `checkItemMergeReadinessFx.ts`
- `applyGameActionMergeFx.test.ts`

### Remove domain

Moved to `src/v0/game/remove/`:

- `removeTileFx.ts`
- `checkTileRemoveReadinessFx.ts`
- `applyGameActionRemoveFx.test.ts`

### Producer domain

- `startProducerProductFx.ts`
- `completeProducerJobFx.ts`
- `processCompletedProducerJobsFx.ts`
- `storeProducerInputFx.ts`
- `withdrawProducerInputFx.ts`
- `setProducerProductLineEnabledFx.ts`
- producer readiness files
- producer readers
- `consumeProducerStoredInputsFx.ts`
- `producerDeliveryTiming.ts`

This is a coherent domain family.

### Craft domain

- `startCraftFx.ts`
- `completeCraftJobFx.ts`
- `processCompletedCraftJobsFx.ts`
- `storeCraftInputFx.ts`
- `withdrawCraftInputFx.ts`
- craft readiness files
- craft readers
- `splitCraftRequirementsFx.ts`

This is a coherent domain family.

### Stash domain

- `openStashFx.ts`
- `stashBoardItemFx.ts`
- `applyStashDepletionFx.ts`
- stash readiness files
- stash readers

This is a coherent domain family.

### Requirements domain

Moved to `src/v0/game/requirements/`:

- `storeStoredRequirementFx.ts`
- `withdrawStoredRequirementFx.ts`
- stored requirement readiness/readers
- `checkGameRequirementsFx.ts`
- passive requirement counting
- activation input check/consume helpers
- input ref resolve/sum/consume helpers

This is not just a stored-requirement helper. Requirements are a shared gameplay subdomain used by producer, craft, stash, upgrade, merge/remove, and stored-requirement actions.

### Upgrades domain

- `startUpgradeFx.ts`
- `completeUpgradeJobFx.ts`
- `processCompletedUpgradeJobsFx.ts`
- `checkUpgradeStartReadinessFx.ts`
- `readUpgradeCompletedTierCountFx.ts`
- `readUpgradeCostInputsFx.ts`
- config layer builders/apply may be adjacent but are not the same thing.

Upgrade runtime and config overlay are related but should stay distinguishable.

### Jobs / tick domain

- `runGameTickFx.ts`
- `processItemSpawnJobsFx.ts`
- `processItemSpawnJobFx.ts`
- `createItemSpawnJobsFx.ts`
- `readDueItemSpawnJobsFx.ts`
- `compareItemSpawnJobs.ts`
- `compareGameTimedJobs.ts`
- `readNextWakeAtMsFx.ts`
- `processCompleted*JobsFx.ts`
- `readCompleted*JobsFx.ts`

This is now conceptually clear after the job/event split, but the files are still scattered in `fx`.

### Inputs / requirements / input refs

Moved into `src/v0/game/requirements/` as part of the requirements extraction. This cross-cutting subsystem feeds producer, craft, stash, upgrade, merge/remove, and stored-requirement behavior.

### Loot / random

Moved to `src/v0/game/loot/`:

- `rollGameQuantityFx.ts`
- `rollWeightedLootTableEntryFx.ts`
- `rollLootTableItemsFx.ts`

Small coherent domain.

### IDs / clone

- `createGameItemInstanceIdFx.ts`
- `createGameItemSpawnJobIdFx.ts`
- `createGameJobIdFx.ts`
- `cloneGameSaveFx.ts`

Small utility cluster.

## Key diagnosis

The engine currently mixes three axes in one folder:

1. Domain: producer, craft, stash, placement, upgrades, requirements.
2. Layer: readiness, apply, read, process jobs, config overlay.
3. Implementation type: Effect.

The third axis, `fx`, currently wins. That is the wrong primary axis for navigation.

A developer looking for producer behavior must mentally collect files from `start*`, `complete*`, `process*`, `read*`, `check*`, `store*`, `withdraw*` prefixes across one massive folder. That is unnecessary load.

## What should not be changed just for cleanup

- Do not split `GameConfigSchema` / `GameSaveSchema` just for line count. They are intentional dense core contracts.
- Do not create a generic job framework just because producer/craft/upgrade/itemSpawn are all jobs. Domain-specific job families are healthy for now.
- Do not introduce capability whitelist enforcement. `GameConfigSchema` is the legality gate.
- Do not deeply nest every domain. Nested folders must earn their existence.

## Proposed target shape

Keep `game` relatively flat at the top. `engine` should remain orchestration glue, not the parent folder for every gameplay domain. Replace the giant `engine/fx` bucket with top-level game domain folders.

Candidate target:

```txt
src/v0/game/
  action/        parse/apply/readiness/match action dispatch shell if it outgrows engine glue
  board/         board move/swap/remove + board readers
  config/        compiled config schema/readers and effective config service pieces
  craft/         craft start/store/withdraw/complete/process/readiness/readers
  inventory/     inventory place/swap/stash-to-inventory helpers if not placement
  jobs/          generic job ordering/wake + itemSpawnJobs + tick helpers if they become domain-sized
  loot/          quantity/weighted loot rolls
  merge/         merge execution/readiness
  placement/     shared placement planner/apply primitives
  producer/      producer product/input/line/delivery job behavior
  requirements/  passive/stored/input ref/activation input logic
  stash/         stash open/depletion/readiness/readers
  upgrade/       upgrade runtime jobs/costs/start/complete
  engine/        orchestration only: apply/readiness/tick adapter/model glue
```

This is more top-level folders than today, but each folder has a real domain name. That is better than one `engine/fx` megabucket. Folder depth remains shallow: top-level game domain plus flat files inside it.

## Alternative lower-risk target

If moving production files feels too large, start with tests:

- Split `applyGameActionFx.test.ts` by domain family:
  - `applyGameActionProducerFx.test.ts`
  - `applyGameActionCraftFx.test.ts`
  - `applyGameActionStashFx.test.ts`
  - `applyGameActionStoredRequirementFx.test.ts`
  - `applyGameActionBoardInventoryFx.test.ts`
  - `applyGameActionMergeFx.test.ts`
- `applyGameActionRemoveFx.test.ts`

This reduces mental load without changing runtime imports.

Then move production files domain-by-domain.

## Domain extraction progress

- [x] `producer` domain extraction into `src/v0/game/producer/`.
- [x] `craft` domain extraction into `src/v0/game/craft/`.
- [x] `stash` domain extraction into `src/v0/game/stash/`.
- [x] `placement` domain extraction into `src/v0/game/placement/`.
- [x] `requirements` domain extraction into `src/v0/game/requirements/`.
- [x] `upgrade` extraction into `src/v0/game/upgrade/`.
- [x] `job` extraction into `src/v0/game/job/`.
- [x] `loot` extraction into `src/v0/game/loot/`.
- [x] `board` / `inventory` extraction for board movement, inventory swapping, and shared board runtime-state cleanup/status helpers.
- [x] `merge` extraction into `src/v0/game/merge/`.
- [x] `remove` extraction into `src/v0/game/remove/`.

No remaining `engine/fx` coding cut. Future work should focus on model-domain placement only if a concrete pain appears.

## Recommended sequence

### Step 1: split the huge action test file by domain

Low behavior risk, immediate navigation win.

Do this before production moves because tests become safer anchors for later refactors.

### Step 2: move producer domain from `fx` to top-level `game/producer`

Producer has the clearest domain cluster and the most internal files. It is a good first production move.

Move producer files and update imports only. No behavior change.

### Step 3: move craft and stash domains

Same pattern as producer.

### Step 4: move placement primitives

Placement is shared and should be explicit. Do this after producer/craft/stash so domain imports point to a stable shared placement folder.

### Step 5: move action shell / readiness orchestration

Only after domain folders exist. `applyGameActionFx` and `readActionReadinessFx` should remain small engine orchestration imports from domain readiness/apply functions.

### Step 6: revisit `fx`

The end state should either delete `fx` or leave it only for true cross-domain Effect glue. A folder named `fx` should not be the main engine architecture.

## Acceptance criteria for future refactor

- No gameplay behavior changes.
- No new domain restrictions.
- `GameConfigSchema` remains the legality gate.
- `GameSaveSchema` / `GameConfigSchema` stay core dense contracts.
- `src/v0/game` domain folder depth remains shallow; do not hide top-level domains under `engine`.
- Each new domain folder can explain its existence in one sentence.
- `applyGameActionFx` and `readActionReadinessFx` remain engine orchestration dispatchers, not domain rule containers.
- Tests remain green after every domain move.

## Completed first coding task

`src/v0/game/engine/fx/applyGameActionFx.test.ts` has been split into domain-family files:

- `applyGameActionProducerFx.test.ts`
- `applyGameActionCraftFx.test.ts`
- `applyGameActionStashFx.test.ts`
- `applyGameActionStoredRequirementFx.test.ts`
- `applyGameActionMergeFx.test.ts`
- `applyGameActionRemoveFx.test.ts`
- `applyGameActionBoardInventoryFx.test.ts`

The shared test helpers live in `applyGameActionFx.testSupport.ts`.

## Completed second coding task

Producer runtime files and the producer action test moved from `src/v0/game/engine/fx` into top-level `src/v0/game/producer`.

Reason: producer is a game domain, not an engine subfolder. `game/engine` should orchestrate producer behavior, not own it.

## Completed third coding task

Craft runtime files and the craft action test moved from `src/v0/game/engine/fx` into top-level `src/v0/game/craft`.

Reason: craft is a game domain, not an engine subfolder. `game/engine` should orchestrate craft behavior, not own it.

## Completed fourth coding task

Stash runtime files and the stash action test moved from `src/v0/game/engine/fx` into top-level `src/v0/game/stash`.

Reason: stash is a game domain, not an engine subfolder. `game/engine` should orchestrate stash behavior, not own it.

## Completed fifth coding task

Placement runtime files and the placement test moved from `src/v0/game/engine/fx` into top-level `src/v0/game/placement`.

Reason: placement is a shared game domain used by producer/craft/stash/jobs/bootstrap/inventory placement flows. `game/engine` should orchestrate placement behavior, not own it.

## Completed sixth coding task

Requirements/input-ref/stored-requirement runtime files and the stored-requirement action test moved from `src/v0/game/engine/fx` into top-level `src/v0/game/requirements`.

Reason: requirements are a shared gameplay subdomain used by producer, craft, stash, upgrade, merge/remove, and stored-requirement behavior.

## Completed seventh coding task

Upgrade runtime files and upgrade lifecycle tests moved from `src/v0/game/engine/fx` into top-level `src/v0/game/upgrade`.

Reason: upgrade lifecycle is a game domain, not engine-owned Effect plumbing. `game/engine` dispatches `upgrade.start` and ticks completed upgrade jobs, but upgrade rules live in `game/upgrade`.

## Current recommended next coding task

The `src/v0/game/engine/fx` cleanup is complete. Do not recreate an `fx` bucket as a primary architecture axis.


## 2026-06-19 update: job domain extraction

Moved generic job helpers, wake calculation, job IDs, and item-spawn job processing to `src/v0/game/job`. `engine/fx` should no longer own delayed/retry gameplay helpers. Remaining likely clusters: config layer, initial save/helper extraction, and orchestration shell.


## 2026-06-19 update: board/inventory action helpers extracted

Board move/swap helpers now live in `src/v0/game/board`, inventory slot swap helpers live in `src/v0/game/inventory`, and inventory-to-board placement readiness lives in `src/v0/game/placement`. `game/engine` imports these domains for action/readiness orchestration.


## 2026-06-19 update: merge/remove domains extracted

Merge execution/readiness now lives in `src/v0/game/merge`, tile removal execution/readiness now lives in `src/v0/game/remove`, and shared board runtime-state cleanup/status helpers live in `src/v0/game/board`. `game/engine` imports merge/remove for action/readiness orchestration.


## 2026-06-19 update: config/save extraction and fx removal

Moved effective config layer/service/context schemas into `src/v0/game/config`, moved save bootstrap/clone/item-instance ID helpers into `src/v0/game/save`, and moved remaining action/readiness/tick orchestration directly into `src/v0/game/engine`.

`src/v0/game/engine/fx` no longer exists. Do not recreate it as a dumping ground for Effect-based files. Effect is an implementation style, not a domain boundary.
