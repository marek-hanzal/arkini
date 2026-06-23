# Board race and codebase review

Date: 2026-06-23  
Repo HEAD at audit start: `5a40d24 Limit batched producer feedback to one bounce`  
Scope: race conditions around board updates, producer/stash/craft interaction safety, duplicate logic, and code mental-load audit after recent runtime slimming.

This is a review report only. No source fixes were applied in this pass, because the first finding is architectural enough that fixing it deserves a focused patch and regression tests rather than one heroic trash-fire mega-commit.

## Checks run

- `npm run format:check` passed. Biome still warns that `game/arkini.assets.json` is larger than the default 1 MiB formatter limit.
- `npm run game:validate -- game/arkini` passed: 87 items, 89 resources. Existing warning remains for `item:leather`, which is terminal and is not configured as a source/product/requirement/removal input.
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json` passed with the same `item:leather` warning.
- `npm run dc` passed: no dependency-cruiser violations.
- `npm run typecheck` passed.
- `npm run test -- --pool=threads --fileParallelism=false` passed: 55 files, 305 tests.
- `npm run build` passed. Vite still warns about a chunk larger than 500 KiB.

## P0: Runtime mutation lost-update race

### Where

`src/v0/game/engine/runtime/RuntimeGameEngineAdapter.ts`

`dispatch` reads `this.save`, starts an async engine run, awaits it, then commits the result. `tick` does the same. `replaceSave` also commits directly without being coordinated with in-flight actions.

The critical shape is:

```ts
const result = await runGameEngineEffect(
  applyGameActionFx({ save: this.save, ... })
);
this.commit(result);
```

and:

```ts
const result = await runGameEngineEffect(
  runGameTickFx({ save: this.save, ... })
);
this.commit(result);
```

Because `await` yields, two mutations can both calculate from the same old save. Whichever commit finishes last wins and silently drops the other update.

### Confirmed reproduction

A temporary local script created two board items and ran two independent move actions concurrently:

```ts
await Promise.all([
  adapter.dispatch({ action: { boardItemId: "item-instance:1", type: "board.item.move", x: 2, y: 0 } }),
  adapter.dispatch({ action: { boardItemId: "item-instance:2", type: "board.item.move", x: 3, y: 0 } }),
]);
```

Expected final board:

- `item-instance:1` at `(2, 0)`
- `item-instance:2` at `(3, 0)`

Actual final board:

```json
{
  "item-instance:1": { "itemId": "item:twig", "x": 0, "y": 0 },
  "item-instance:2": { "itemId": "item:rock", "x": 3, "y": 0 }
}
```

The first move was lost. This is not a theoretical race. It is reproducible with two plain board moves, meaning it can also hit DnD, producer completion ticks, stash release, auto-fill, scenario reset, and any user action that lands while the ticker is applying due jobs.

### Why this can kill board state

`GameRuntimeAutoTicker` schedules `store.tick()` from React while user DnD calls `store.dispatch()`. `GameRuntimeStore` forwards both directly to the adapter. There is no mutation queue, mutex, generation token, or optimistic compare-and-swap.

Bad interleavings now possible:

- user drags an item while a producer completes and outputs items
- user triggers auto-fill while the same producer is ticking/completing
- stash release lands while DnD commit is resolving
- debug scenario/reset calls `replaceSave` while action/tick is in flight
- double-click/double-tap starts two actions before first commit publishes

The result is last-write-wins over the entire save object. Lovely little state shredder, very artisanal.

### Recommendation

Add one central mutation queue at `RuntimeGameEngineAdapter` or `GameRuntimeStore` boundary.

All mutating operations must run through it:

- `dispatch`
- `tick`
- `replaceSave`

The queued job must read `this.save` only when it reaches the front of the queue, not before. That makes every action run against the freshest committed save.

Sketch:

```ts
private mutationQueue: Promise<unknown> = Promise.resolve();

private enqueueMutation<T>(run: () => Promise<T>): Promise<T> {
  const next = this.mutationQueue.then(run, run);
  this.mutationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
```

Then wrap `dispatch`, `tick`, and `replaceSave` internals in `enqueueMutation`.

Readiness can remain non-mutating, but anything using readiness as preflight must assume stale reads and rely on engine rejection at dispatch time. If that gets noisy, readiness can also wait for the queue to drain before checking.

### Regression tests

Add focused tests around `RuntimeGameEngineAdapter` or `GameRuntimeStore`:

1. Two concurrent independent board moves preserve both updates.
2. `dispatch` plus `tick` preserves both the user action and completed producer output.
3. `replaceSave` cannot be overwritten by an older in-flight `dispatch`/`tick` result.
4. Concurrent producer starts cannot bypass queue size or overwrite each other.

## P0: `removeBoardItemRuntimeState` misses `producerInputs`

### Where

`src/v0/game/board/removeBoardItemRuntimeState.ts`

The helper deletes runtime state maps for removed board items:

- `stashes`
- `stashInputs`
- `producerLines`
- `craftInputs`
- `storedRequirements`
- matching `producerJobs`
- matching `craftJobs`

It does **not** delete:

- `producerInputs[itemInstanceId]`

### Why it matters

The current save schema validates producer inputs against an existing producer target. If a producer is removed/merged/consumed/replaced and `producerInputs` remains behind, the live save can become invalid and persistence will start failing validation. Worse, the stale input map can affect a later tile with the same id or make UI readers show ghost resources.

This is especially suspicious because `readBoardItemRuntimeStateStatus` counts `producerInputs` as part of preservable runtime state, but the cleanup helper does not delete it. That asymmetry is a bug smell so strong it should probably pay rent.

### Recommendation

Add:

```ts
delete save.producerInputs[itemInstanceId];
```

to `removeBoardItemRuntimeState`.

Then add tests for removing/stashing/merging/replacing a producer with stored product inputs.

## P0/P1: Board input consumption skips runtime-state cleanup

### Where

`src/v0/game/requirements/consumeResolvedInputRefFx.ts`

For board refs, the code only deletes the board item:

```ts
delete nextSave.board.items[boardRef.itemInstanceId];
```

For inventory instance refs, it clears the slot and calls `removeBoardItemRuntimeState`.

### Why it matters

Board resources can be consumed by producer/craft/stash input actions. If the consumed board tile has runtime state, jobs, stored requirements, stash/producers/craft inputs, or any other per-instance state, deleting only `board.items[id]` leaves orphan runtime data behind.

That can happen through:

- manual DnD feeding into producer/craft/stash target
- auto-fill planner picking a board item by matching `itemId`
- future configs where a stateful thing is also valid as input
- a bug or debug scenario that leaves a busy/resource-like tile on board

Even if the design says “input resources should be stateless”, the engine currently does not enforce that at the resolution boundary.

### Recommendation

Do one of these, preferably both:

1. In `consumeResolvedInputRefFx`, call `removeBoardItemRuntimeState` for board refs before/after deleting the board item.
2. In input resolution/planning, reject board item refs that are busy/stateful/non-consumable.

The better long-term model is a shared `readBoardItemInputConsumability` / `checkBoardItemConsumableAsInputFx` policy used by manual DnD and auto-fill. Then consuming a running producer, half-filled stash, active craft target, etc. becomes impossible at engine level instead of “please UI, do not betray us.”

## P1: DnD allows busy/runtime-state board tiles to move or swap

### Where

- `src/v0/game/board/checkBoardItemMoveReadinessFx`
- `src/v0/game/board/checkBoardItemsSwapReadinessFx`
- related merge/remove/stash readiness guards

Move readiness only checks:

- target inside board bounds
- source item exists
- target cell is empty

Swap readiness only checks:

- both source and target exist

No busy/runtime-state guard is applied.

### Why it matters

User interaction can move/swap tiles while producer jobs are running, while a producer/stash/craft has stored inputs, or while output delivery is pending/retrying. Depending on intended design, moving a running producer might be okay if the output seed follows the current cell. But the user explicitly called out immunity around DnD while producer runs/outputs, so the current contract is too loose.

The dangerous part is not just visual weirdness. A move action racing with a tick can be lost due to the P0 mutation race above. Once the queue is fixed, move/swap behavior will become deterministic, but still possibly semantically wrong if busy tiles should be locked.

### Recommendation

Define one central board-item interaction lock policy.

Recommended v0 policy:

- if a board item has active/preserved runtime state, it is locked for board mutation actions
- locked item can still open detail
- locked item cannot be source or target for move/swap/merge/remove/stash/input-consumption unless the specific action explicitly supports it

Implement engine-side guards first. UI disabled state is only sugar. UI-only guards are a teddy bear with a database connection.

Then expose the lock status to board view, for example:

```ts
interaction: {
  locked: boolean;
  reason?: "producer_running" | "craft_running" | "stored_inputs" | "stash_pending" | ...;
}
```

TileEngine should receive this as generic `disabled`/`interactive` metadata, not Arkini domain imports.

### Tests

Add rejection tests for:

- moving a producer with running job
- swapping a producer with running job
- consuming a producer/stash/craft target as input
- merging into/out of a target with stored inputs or running job
- remove/stash of busy state already partly covered, but add producer inputs/stash inputs/craft inputs coverage

## P1: `replaceSave` can be overwritten by stale in-flight mutations

### Where

`RuntimeGameEngineAdapter.replaceSave`

`replaceSave` computes `nextWakeAtMs` asynchronously and commits directly. If a user resets scenario or storage while a dispatch/tick is in flight, the older action can commit after the replacement and resurrect old state.

### Recommendation

Put `replaceSave` into the same mutation queue as `dispatch`/`tick`. If the UX needs hard reset to cancel older queued work, add a generation token and have older jobs drop their result when generation changes.

## P1: Auto-fill planners are copy-pasted three times

### Where

- `src/v0/game/producer/planProducerProductAutoFillInputRefsFx.ts`
- `src/v0/game/craft/planCraftAutoFillInputRefsFx.ts`
- `src/v0/game/stash/planStashAutoFillInputRefsFx.ts`

All three implement the same algorithm:

1. read already stored input quantities
2. calculate missing quantity
3. scan board items sorted by `y/x/id`
4. reserve board item ids
5. scan inventory slots
6. reserve slot quantities
7. return `GameActionItemRef[]`

The only meaningful variation is where stored quantities come from and what target item id to exclude.

### Why it matters

The next correctness fix almost certainly needs to exclude busy/stateful/non-consumable board items from auto-fill. With three planners, the odds of fixing two and forgetting one are boringly high. This is how bugs breed, because apparently code is also livestock now.

### Recommendation

Create one shared planner in the requirements/input domain, e.g.:

`src/v0/game/requirements/planActivationInputRefsFx.ts`

Inputs:

- required inputs
- save
- stored input quantities
- excluded board item ids
- optional board candidate predicate / consumability check

Producer/craft/stash should only provide domain-specific stored quantities and target exclusion.

## P2: Available-quantity reader duplication

### Where

- `src/v0/play/runtime/readers/readRuntimeProducerActivationViewFromGameSave.ts`
- `src/v0/play/runtime/readers/readRuntimeCraftViewFromGameSave.ts`

Both contain very similar logic for available input quantity across board and inventory.

### Recommendation

Extract shared input availability reader, ideally in runtime readers or requirements view domain. This is lower priority than auto-fill planner dedupe, but it belongs to the same cleanup family.

## P2: Visual/transient global stores are not cleared on runtime destroy/reset

### Where

- `src/v0/play/runtime/GameRuntimeContext.tsx`
- `src/v0/play/game-engine-visual/applyGameEngineVisualPlan.ts`
- `src/v0/tile-engine/TileEngineMotionRequestStore.ts`
- `src/v0/board/animation/BoardTransientTileStore.ts`

There are global stores and clear functions:

- `clearTileEngineMotionRequests`
- `clearBoardTransientTiles`

Tests use these clear functions, but runtime provider destroy/reset does not appear to clear them.

### Why it matters

Scenario reset, hard runtime replacement, or provider remount can leave old transient tiles/motion requests alive until their timeout cleanup runs. Most of the time this is visual dirt, not save corruption, but after the stash/producer animation changes this is the kind of “why is that ghost tile flying?” bug that wastes an hour and everyone’s remaining dignity.

### Recommendation

Clear transient board tiles and motion requests on runtime destroy and before/after `replaceSave` scenario reset. If we need animations across a normal state update, keep them. If we replace the whole save/runtime, purge them.

## P2: Dependency cruiser is not dead-code detection here

`npm run dc` is useful and currently green, but the current config uses `skipAnalysisNotInRules`, so it does not give a trustworthy orphan/dead-code inventory. Do not read a clean dependency-cruiser result as “no dead files”. It only says dependency rules passed.

For dead-code review, use a separate entrypoint import graph or `knip`/similar later. Not urgent, but worth remembering before we declare the corpse drawer empty.

## Current shape after slimming

The good news: the architecture is now much easier to reason about than the old cache/SQLite/action soup.

The current truth path is mostly clean:

- `GameConfig` + `GameSave`
- pure Effect engine actions/ticks
- `RuntimeGameEngineAdapter`
- `GameRuntimeStore`
- focused `useSyncExternalStore` readers
- debounced Dexie save persistence

That is good. Annoyingly good, even. The main problem is that the adapter currently exposes async mutation methods without serializing them, so the clean model is standing on a banana peel.

## Recommended fix order

1. Serialize `dispatch`, `tick`, and `replaceSave` in `RuntimeGameEngineAdapter` or `GameRuntimeStore`.
2. Add regression tests proving concurrent board actions no longer lose updates.
3. Fix `removeBoardItemRuntimeState` to delete `producerInputs`.
4. Make board input consumption call cleanup and/or reject non-consumable stateful/busy board items.
5. Define and implement board-item interaction lock policy for busy/runtime-state tiles.
6. Dedupe the three auto-fill planners into one requirements/input planner.
7. Extract shared input availability quantity reader.
8. Clear visual/transient global stores on runtime destroy/reset.
9. Only then do broader dead-code cleanup, because fixing race safety first matters more than alphabetizing the junk drawer.

## Suggested first patch scope

Keep the first patch narrow:

- mutation queue in adapter
- tests for concurrent dispatch/tick/replaceSave
- no gameplay policy changes yet

Then second patch:

- board runtime-state cleanup and producerInputs deletion
- board input consumability guard
- tests

Then third patch:

- interaction lock policy and UI disabled metadata

Trying to do all of this in one pass would produce a heroic pile of mud. Noble, but still mud.
