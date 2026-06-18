# v0 focused runtime subscriptions checkpoint

Date: 2026-06-18
Commit: see latest checkpoint commit

## What changed

Second raw/subscription pass after `025a923` kept the runtime source-of-truth model and reduced broad subscriptions in UI surfaces.

Main cleanup:

- `BoardSurface` no longer subscribes to a second full board view just to decorate blocked cells. `useBoardTileEngineModel` already owns the board view for tile rendering and now returns `blockedCellKeys` for slot status rendering.
- `useBoardTileEngineModel` no longer subscribes to inventory view. Inventory is only needed when committing a drop, so `onDrop` reads the latest raw runtime snapshot at drop time and derives board/inventory views from that snapshot.
- `useInventoryTileEngineModel` no longer subscribes to full board view or config. It subscribes only to inventory plus focused `firstEmptyCell`; drop commits read latest raw snapshot/config at drop time.
- `ItemSheet` no longer subscribes to full board view. It subscribes to the selected board item only and ticks only against that selected item.
- Added `useGameBoardFirstEmptyCell` focused selector.

## Rationale

The runtime store now owns only raw snapshot/revision/time. This pass pushed more UI code toward the same model: subscribe only to data needed for rendering, and use imperative raw reads only at action/drop commit time where freshness matters more than render subscription identity.

This is not a gameplay change. It reduces render coupling and mental load around “why did this surface subscribe to that whole view?”

## Guardrails

- Do not reintroduce board/inventory gameplay cache patchers.
- Action/drop commit handlers may read `store.getSnapshot()` at commit time. That is allowed and preferable to subscribing a component to unrelated state just to keep a future callback warm.
- Visual motion/transient stores remain separate and visual-only.
- Broad `useGameBoardView` / `useGameInventoryView` hooks still exist for surfaces that truly render whole board/inventory; do not use them for one value like first empty cell or selected item.

## Follow-ups

Potential later slices if needed:

- Split inventory surface into slot-level subscriptions if full inventory renders become noisy.
- Split board tile list from board item detail derivation if board updates become hot.
- Add render-count tests only if we get a real regression. Avoid testing React internals just to feel productive.
