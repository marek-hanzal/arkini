# Overhaul TileEngine drag and drop

Status: DONE
Priority: CRITICAL

## Goal

Revisit the whole drag/drop runtime. Current behavior is not trustworthy enough for a game: items do not snap reliably, actors can fly out of the board, swap placement feels random, and confinement is wrong across board vs inventory.

The output of this task is a more stable TileEngine-owned DnD interaction layer where Motion owns physical dragging, TileEngine owns generic surface/target resolution, and Arkini owns only game semantics.

## Library-first analysis

Installed Motion already provides reliable drag primitives: physical drag, MotionValues, drag constraints, drag momentum/elastic controls, and drag lifecycle callbacks. We should use that instead of owning raw pointer movement with custom `pointermove` math.

Rejected options:

- `dnd-kit`: too much semantic DnD machinery, previously conflicted with Motion/layout animation ownership.
- `@use-gesture/react`: useful, but it would add another gesture layer while Motion already exists in the stack and covers the needed drag primitive.

Decision:

- Use Motion for physical drag and confinement primitives.
- Keep TileEngine generic hit-testing, target registry, lifecycle cleanup, tap/long-press wrapper, and command dispatch callbacks.
- Keep Arkini-specific target meanings outside TileEngine.

## Reported symptoms

- Board items sometimes do not attach/snap to the intended board cell.
- Items can visually fly out of the board after drag/drop.
- Swap behavior is random-feeling and actors do not land in the expected slots.
- Confinement is wrong:
  - board drag confinement should be the whole play/root board interaction area,
  - inventory drag confinement should be the inventory cell container/surface, not the whole root.
- Accepted drop, rejected drop, cancel, and rollback are visually too easy to desync.

## Completed

- Replaced TileEngine's in-house physical drag loop with Motion drag primitives.
- Removed manual per-frame pointer delta updates from TileEngineActor.
- Kept custom pointer handling only for tap, double tap, long press, context-menu suppression, and lifecycle cleanup.
- Added `dragConstraintsRef` to TileEngine public API.
- Board passes the full play root element as drag constraint through `PlayRootElementProvider` / `usePlayRootElement`.
- Inventory uses the TileEngine root as default drag constraint, so inventory actors stay inside the inventory grid/container.
- Replaced TileEngine slot drop target registration with an internal generic rect registry.
- Kept the global drop target registry only as an external fallback for special targets outside a TileEngine surface, such as bottom navigation inventory drop.
- Target resolution now checks TileEngine slot rects first, then external fallback.
- Accepted drop `dragRect` is read from the actual transformed actor DOM rect at drag end.
- Pointer position remains the source of target hit-testing, separate from actor rect.
- Updated `@chat-gpt/README.md` with the library-first rule for future tasks.

## Acceptance

- [x] Board drag is visually confined to the intended board/root surface through Motion `dragConstraints`.
- [x] Inventory drag is visually confined to the inventory grid/cell container by default TileEngine constraints.
- [x] Dropping on a valid board cell resolves from TileEngine slot rects instead of relying only on global `elementsFromPoint`.
- [x] Dropping on a valid inventory slot resolves from TileEngine slot rects instead of relying only on global `elementsFromPoint`.
- [x] Invalid external/special targets can still resolve through the external fallback registry.
- [x] Invalid drop return remains in drag runtime as interaction physics.
- [x] Cancel paths clear active drag, active target highlight, hidden sources, and motion state.
- [x] Pointer move does not update React state per frame for physical movement; MotionValues own drag movement.
- [x] TileEngine remains standalone; no Arkini domain imports are introduced.
- [x] Typecheck and build pass.

## Manual validation still recommended

Run these in a browser/device because no headless build can prove touch-feel correctness:

- board item move to empty board cell,
- board item swap with occupied board cell,
- board merge,
- board feed producer/stash/craft input,
- board item drag into inventory nav target,
- inventory slot swap,
- inventory item place on board,
- drag outside valid target then return,
- pointer cancel / window blur / orientation change / resize,
- long press does not open native mobile context menu.

## Watchouts

- Do not solve this by reintroducing `dnd-kit`.
- Do not leak Arkini command visual events into TileEngine.
- Do not put board/inventory coordinate types inside TileEngine.
- Do not add one-off DOM hacks for a single symptom. This task is a system revisit, not bug whack-a-mole.
- Keep native mobile long-press menu suppressed.
