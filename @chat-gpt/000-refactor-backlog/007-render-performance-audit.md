# Render performance and remount audit

Status: TODO

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
