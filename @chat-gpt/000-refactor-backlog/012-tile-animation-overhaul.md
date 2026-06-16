# Overhaul tile animations through TileEngine

Status: IN_PROGRESS
Priority: CRITICAL

## Goal

Centralize real tile animations inside TileEngine. Outside layers may decide what happened and map game events into generic animation requests, but they must not physically animate board/inventory item actors themselves.

The desired architecture is:

intent -> command -> state change -> command visual events -> Arkini adapter maps to generic TileEngine animation requests -> TileEngine performs actor animations.

Outside TileEngine can still animate non-tile UI affordances such as buttons, sheets, nav pulses, or cell feedback. It must not animate actual tile actors directly.

## Reported symptoms

- Animations feel inconsistent and scattered.
- Some actors fly or settle from wrong rects.
- Swap/move/drop animation behavior is mixed with drag state and external visual registries.
- There is still too much room for board/inventory/play hooks to stage tile movement outside the engine.
- The current architecture has improved, but animation ownership is not strict enough.

## Current technical risk areas

- `stageCommandVisualEvents` maps app-specific command visual events to external visual motion registry entries.
- `useVisualItemMotions`/visual motion staging lives outside TileEngine and feeds `tile.motion` back into TileEngine actors.
- TileEngine performs the actual Motion animation in `useTileEngineMotionAnimation`, but orchestration still partly lives outside.
- `drag` still owns rejected-return animation through generic drag runtime. This may remain outside only if it is clearly modeled as interaction physics, or it should become a generic TileEngine return animation.
- Some local helpers in `src/animation` are UI feedback helpers and should be classified so future work does not confuse them with tile actor animation.

## Required design rules

- TileEngine stays standalone.
- TileEngine may accept generic animation requests through public API, props, or injected hooks.
- Arkini-specific visual event mapping stays outside TileEngine.
- TileEngine must be the only layer that mutates/transforms real board/inventory tile actor DOM.
- Domain command results must stay semantic, not pixel-based.
- Animation planning may use DOM rects outside TileEngine only to create generic requests; final execution belongs to TileEngine.
- Avoid remount-driven animation. Actor key stability is mandatory.

## Proposed work

### 1. Define animation ownership taxonomy

Document and enforce three categories:

1. Tile actor animations: move, swap, merge, consume, spawn, feed, activation burst, craft claim. These belong to TileEngine execution.
2. Interaction physics: active drag follow, rejected drop return, cancel recovery. Prefer TileEngine ownership; if kept in drag runtime, it must use generic TileEngine hooks and not Arkini-specific animation state.
3. UI affordance animations: nav pulse, button bounce, cell highlight/error/success. These may stay outside TileEngine because they are not tile actor transforms.

### 2. Create generic TileEngine animation request API

Possible shape:

- `TileEngineAnimationRequestSchema` or TS type only if schema is unnecessary.
- request kinds:
  - `actor.moveFromRect`,
  - `actor.spawnFromRect`,
  - `actor.consumeToRect`,
  - `actor.swapWith`,
  - `actor.pulse`,
  - `actor.exit`,
  - `actor.returnToOrigin`.
- generic fields only:
  - `actorId`,
  - `fromRect`,
  - `toActorId` or `toSlotId` if generic,
  - `priority`,
  - `transitionKind`,
  - `nonce/groupId`,
  - timing policy.

No `itemId`, no `boardItemId`, no `inventorySlotIndex`, no `activation` inside TileEngine.

### 3. Move execution registry into TileEngine

Today the game-level visual motion registry stages entries and TileEngine consumes `tile.motion`. The stricter target should be:

- TileEngine receives animation requests through a handle/prop/hook,
- TileEngine stores transient animation registry internally,
- TileEngine resolves actor lifecycle and settle callbacks,
- parent only commits data/query state and passes stable actors/slots.

The Arkini adapter may still compute rects and actor keys, but it should hand generic requests to TileEngine rather than storing motion state in play-level hooks.

### 4. Rework command visual event adapter

`stageCommandVisualEvents` should become a mapper from `CommandVisualEvent` to generic TileEngine animation requests.

It should not stage game-level visual motions directly after this task.

Expected mapping examples:

- `item.moved` -> actor move request,
- `item.swapped` -> two actor move requests or swap group,
- `item.merged` -> consume source + pulse/spawn target,
- `item.fed` -> consume source + pulse target,
- `item.spawned` -> spawn actor from source rect,
- `activation.activated` -> pulse/burst source actor,
- `craft.claimed` -> transform/pulse actor.

### 5. Remove or quarantine external tile animation helpers

Audit and either remove, rename, or explicitly classify:

- `useVisualItemMotions`,
- `stageCommandVisualEvents`,
- `commandVisualEventStageEntries`,
- `actorVisualRect`,
- `locationVisualRect`,
- `locationVisualActorKey`,
- `placeInventoryOnBoardWithFly`,
- drag return animation utilities.

If a helper remains outside TileEngine, its name/documentation must make clear that it maps Arkini semantics to generic engine requests, not that it performs tile animation.

### 6. Animation settlement contract

Define and enforce:

- when request is staged,
- when data invalidation/render happens,
- when actor is hidden or shown,
- when motion state settles,
- how interrupted animations are canceled/replaced,
- how resize/orientation/pointer cancel clears or recalculates animations.

This must prevent ghost actors, stale hidden sources, duplicate actors, and post-invalidation teleporting.

## Acceptance

- TileEngine performs all real tile actor transforms.
- Board/inventory/play hooks do not directly stage tile actor motion outside TileEngine.
- `src/tile-engine` remains free of Arkini-specific imports.
- Command visual events remain semantic and app-level.
- Arkini adapter maps semantic events to generic TileEngine animation requests.
- Move, swap, merge, feed, activation output spawn, inventory placement, and craft claim all animate through the same engine execution path.
- Rejected drop return is either owned by TileEngine or explicitly documented as generic interaction physics with no Arkini-specific visual registry.
- UI affordance animations outside TileEngine are explicitly allowed only for non-tile elements.
- Typecheck and build pass.

## Watchouts

- Do not centralize animation by making TileEngine understand Arkini gameplay. That would just move the mess into a shinier basement.
- Do not solve by hiding/remounting actors. Stable actor identity is the entire point.
- Do not keep both old visual motion registry and new TileEngine request registry as parallel truths.
- Do not overfit animation requests to current board/inventory layout. TileEngine should remain reusable.

## 2026-06-16 progress note

- Added `TileMotionRuntime` as the cancellable TileEngine actor motion runtime.
- Added origin-aware tile enter motion through generic `fromTileId`, so producer/stash spawns can animate from the current source actor without the game layer mutating actor DOM.
- Stash exhaust sequencing now delays `activation.depleted` until the sequenced output batch has finished visually.
- Depleted stashes are now persisted as empty/unclickable until the output animation completes, then a delayed finalizer applies the durable depletion. This keeps the source tile draggable while it is still visually vomiting items, instead of deleting the row before the animation has even had the decency to happen.

Keep this task open: the remaining work is to replace the old play-level motion staging/cleanup vocabulary with a stricter generic TileEngine animation request adapter. Do not do that as a giant rewrite unless the current runtime starts behaving like a haunted umbrella.

## 2026-06-16 mobile/presence tuning note

- Slowed global tile/action animation timings by roughly 50% so movement and spawn/merge presence have time to read visually instead of flashing like a tiny UI seizure.
- Added a dedicated TileEngine `presenceDurationSeconds` and shared `motionCleanupBufferMs` so merge enter/exit cleanup no longer duplicates local magic buffers.
- Presence motions now mark the visual element with `data-ak-tile-engine-presence-motion` while WAAPI owns `opacity`/`transform`; CSS transitions are disabled during that window to avoid transition/WAAPI property fights on merge success, especially on iOS Safari.
- Merge-in/out scale deltas are deliberately less aggressive. The animation should read as a cross-fade/pop, not a rasterized accordion having a bad day.

Keep task 012 open. This commit improves the existing runtime path; it does not yet replace the remaining play/cache visual-event adapter vocabulary with a formal generic TileEngine animation request API.

## 2026-06-16 adapter vocabulary cleanup note

- Removed the old `src/v0/play/motion` module name. It was too easy to read as play-level tile animation ownership, even though execution already belongs to TileEngine.
- Added `TileEngineMotionSchema` next to the TileEngine enter/exit schemas. Board/inventory cache view rows may still carry temporary presence metadata, but the schema now clearly belongs to the generic engine boundary.
- Moved the Arkini semantic adapter helpers to `src/v0/play/tile-engine-motion`: `toTileEngineEnterMotion` and `toTileEngineExitMotion`. These helpers map `ActionVisualAnimation` into generic TileEngine presence motion; they must not touch DOM or run animations.

Keep task 012 open. The remaining larger step is a real TileEngine animation request queue/registry so cache rows no longer need to carry `motion` metadata as the handoff vehicle. Do that only after current mobile/merge behavior stays stable.

## 2026-06-16 presence ownership race note

- Presence motions now mark the visual element with a unique token instead of a shared `true` flag. A cancelled/replaced enter or exit motion may only clear `data-ak-tile-engine-presence-motion` when its token still owns the visual.
- Enter/exit hooks now cancel their own TileEngine presence scope on cleanup. This prevents stale WAAPI work and stale CSS-transition locks when a presence request is replaced, the actor unmounts, or React runs effect cleanup during development.
- This specifically protects merge success on mobile Safari: an older cancelled fade-out/fade-in promise can no longer re-enable `.ak-tile-engine-visual` CSS transitions in the middle of the newer WAAPI presence animation.

## 2026-06-16 drag/motion ownership note

- Pointer down now explicitly cancels the outer actor transform motion scope before resetting the actor transform and creating a new drag session. Direct drag interaction must not leave an old layout/snap/reject WAAPI task alive behind the user pointer, because a late `finished` continuation can otherwise commit stale inline transform over the drag-owned transform.
- This cancellation is intentionally scoped to `tileMotionScope(tile.id)` instead of all descendant motions. Do not cancel presence motion on the inner visual just because the user touches a tile; freezing a half-faded visual is how we get ghost opacity bugs and then pretend Safari is cursed.

## 2026-06-16 motion token sequence note

- Tile motion IDs and presence tokens now use monotonic in-module counters instead of rounded `performance.now()` timestamps. Owner identity must be collision-proof within a JS runtime; “timestamp but probably fine” is how stale async cleanup gets one lottery ticket too many.

## 2026-06-16 presence marker selector note

- Presence marker CSS now matches any `data-ak-tile-engine-presence-motion` value instead of only `"true"`. The marker became a unique owner token, so the old equality selector silently stopped disabling CSS transitions during WAAPI enter/exit animations. Yes, the bug was one CSS selector cosplaying as architecture.
