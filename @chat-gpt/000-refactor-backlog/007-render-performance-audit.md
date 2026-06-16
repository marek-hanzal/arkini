# Render performance and remount audit

Status: DONE

## Goal

Ensure board/inventory/tile rendering stays fast, stable, and animation-friendly.

## Current state

- Components were moved toward controller hooks and scalar-friendly props.
- Suspense read hooks reduced `if data` clutter.
- TileEngine actor lifecycle received a first stability pass.

## Audit checklist

- Board tile keys are actor IDs, not slot positions.
- Moving an item does not remount the actor.
- Pointer movement does not cause React renders.
- Callback props are stable where they cross memoized/engine boundaries.
- Complex objects are not passed through multiple component layers when a component can subscribe to its own view hook.
- Hidden sheet tabs do not mount heavy data views until selected.
- Motion settlement does not restart on parent re-render.

## Acceptance

- Add comments or small diagnostics where remount risk is high.
- Remove unused props/callbacks from board/inventory/tile components.
- Use React Query/selectors or focused hooks for view data instead of prop-drilled snapshots.
- Typecheck and build pass.

## Watchouts

- Do not blindly wrap everything in `memo`. Fix data flow first.
- Do not put transient drag position into React state.

## 2026-06-16 result slice

- Checkpointed the prior test coverage state into `v0`.
- Added stable `TileEngine.Slot.dropId` support so hover feedback can be scoped before slot render. Board/inventory adapters now provide stable drop ids and no longer return redundant drop ids from every slot binding.
- Changed `TileEngineSlot` to receive only its own resolved feedback instead of global `activeDropId` / `activeDropFeedback`, so drag-over changes do not pass changing props to every slot. This keeps memoized cells asleep except for the previous/current hover targets.
- Removed unnecessary per-cell inventory slot query subscription from `InventoryCell`; it only needed the slot index it already receives.
- Removed the per-tile inventory slot query from `InventoryTile`; stack id, item id and quantity now come from TileEngine tile data, while the tile still subscribes only to the item catalog view.
- Added DEV timeline actor lifecycle diagnostics (`actor.lifecycle.mount` / `actor.lifecycle.unmount`) so bug reports can prove whether a move reused the same actor or accidentally remounted it.

Final 2026-06-16 closure slice:

- Checkpointed the first render-audit slice into `v0` before touching TileEngine equality semantics.
- Added adapter-owned `renderKey` tokens for TileEngine slots/tiles so memoized slot/actor components can treat recreated cache snapshot objects as equivalent when their renderer data is semantically unchanged.
- Added shallow TileEngine slot/tile equality helpers and wired custom memo comparators into `TileEngineSlot` and `TileEngineActor`. Geometry, visibility, style, motion request, feedback and callback changes still wake the component; equivalent `renderKey` data churn does not.
- Moved current drag config behind a stable ref at the TileEngine boundary, so board/inventory cache changes can update drag/drop behavior without forcing every slot/actor prop to change. Pointer-down re-reads the latest binding from the ref, so skipped actor renders do not leave tap/drag source data stale.
- Changed inventory slot data to carry only stable slot layout data (`slotIndex`) instead of the full mutable stack snapshot; inventory stack details now live only on tile data where changes are expected to wake the actor.
- Kept hidden sheet views lazy by review: `PlayShell` only renders the currently active sheet content inside `BottomSheet`.

Result: DONE. Remaining performance work should be driven by profiler/manual mobile evidence, not by speculative memo carpeting.
