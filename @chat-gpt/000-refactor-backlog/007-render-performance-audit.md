# Render performance and remount audit

Status: IN_PROGRESS

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

Remaining audit areas: actor remount diagnostics, parent render/callback stability review, and any mobile-specific render churn found during manual play.
