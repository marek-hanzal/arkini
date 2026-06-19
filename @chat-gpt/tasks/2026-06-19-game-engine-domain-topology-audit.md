# Game engine domain topology audit

Status: active audit. First coding steps done: `applyGameActionFx.test.ts` was split by domain family; producer runtime files were moved to top-level `game/producer` without behavior changes.

## Problem

`src/v0/game/engine/fx` is currently grouped by implementation style: “this file is an Effect”. That is not a domain boundary.

The flat structure was useful while stabilizing the engine, but `fx/` now has 100+ files with unrelated workflows next to each other: action dispatch, readiness, placement, producer, craft, stash, upgrades, jobs, config overlay, loot, IDs, and low-level readers.

This creates navigation load. The engine is not conceptually one giant `fx` domain; it is multiple domain workflows using Effect.

## Current source shape

- `src/v0/game/engine/fx`: 111 files.
- `src/v0/game/engine/model`: 68 files.
- `src/v0/game/engine/runtime`: 3 files.
- `src/v0/game/engine/logic`: 4 files.
- `src/v0/game/engine/context`: 1 file.

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

- `placeGameSaveItemsFx.ts`
- `placeSingleGameSaveItemRequestFx.ts`
- `placeGameSaveInventoryItemsFx.ts`
- `placeGameSaveInventoryInstanceFx.ts`
- `placeGameSaveInventoryRemainderFx.ts`
- `placeInitialInventoryItemFx.ts`
- `placeInventoryItemOnBoardFx.ts`
- `planEmptyBoardCellsFx.ts`
- `findFirstEmptyBoardCellFx.ts`
- `createInitialGameSaveFx.ts` (partially)

This is a real shared primitive. It deserves to be navigable as placement, not lost between producer/craft/readiness files.

### Board/inventory movement, merge, remove

- `moveBoardItemFx.ts`
- `swapBoardItemsFx.ts`
- `swapInventorySlotsFx.ts`
- `mergeItemFx.ts`
- `removeTileFx.ts`
- readiness files for those actions
- `readBoardItemCell.ts`
- `removeBoardItemRuntimeState.ts`

This is interaction/action behavior, not producer/craft/stash domain.

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

### Stored requirements domain

- `storeStoredRequirementFx.ts`
- `withdrawStoredRequirementFx.ts`
- stored requirement readiness files
- `readStoredRequirementQuantitiesFx.ts`
- `readStoredRequirementSlotsFx.ts`
- `findStoredRequirementSlotFx.ts`

This is not just a helper. Stored requirements are a reusable gameplay subdomain used by multiple actor types.

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

- `checkActivationInputsFx.ts`
- `consumeActivationInputsFx.ts`
- `mergeActivationInputRequirementsFx.ts`
- `checkGameRequirementsFx.ts`
- `resolveInputRefsFx.ts`
- `consumeResolvedInputRefFx.ts`
- `sumResolvedInputRefsFx.ts`
- `countPassiveItemQuantityFx.ts`

This is a cross-cutting input/requirement subsystem. It feeds producer/craft/stored requirement behavior.

### Loot / random

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
  - `applyGameActionMergeRemoveFx.test.ts`

This reduces mental load without changing runtime imports.

Then move production files domain-by-domain.

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
- `applyGameActionMergeRemoveFx.test.ts`
- `applyGameActionBoardInventoryFx.test.ts`

The shared test helpers live in `applyGameActionFx.testSupport.ts`.

## Completed second coding task

Producer runtime files and the producer action test moved from `src/v0/game/engine/fx` into top-level `src/v0/game/producer`.

Reason: producer is a game domain, not an engine subfolder. `game/engine` should orchestrate producer behavior, not own it.

## Current recommended next coding task

Move the craft domain from `src/v0/game/engine/fx` into top-level `src/v0/game/craft`.

Reason: craft is the next coherent domain cluster and already has a dedicated action test anchor. Move files/imports only; no behavior changes.
