# Duplicate route follow-up pass - 2026-07-04

Continued the route-unification and single-responsibility cleanup after `588a64ca`.

## Goals

- Keep finding duplicate routes that perform the same domain mutation or guard in multiple places.
- Split long functions where the body implemented too many steps directly.
- Keep moving execution-heavy logic toward named `Fx` phases and context-backed orchestration.
- Prefer `ts-pattern.exhaustive()` where route maps should fail loudly when a new variant appears.

## Changes

- Shared inventory item creation events through `pushInventoryItemCreatedEventFx` and split inventory remainder placement into existing-stack and empty-slot routes.
- Reused the same stack-placement route for starting inventory initialization without emitting runtime events.
- Added shared inventory consume helpers: `createInventoryItemConsumedEventFx` and `readInventorySlotAfterQuantityRemovalFx`.
- Split `startCraftFx` into `CraftStartExecutionScopeFx` phases for working state, autofill, early result, constraints, job insert, and result assembly.
- Split world processable job facts into item-spawn, producer, craft, and active-effect routes.
- Split active-effect fact reading into source-location, definition lookup, producer-bound pause status, and time-status helpers.
- Split `processWorldSnapshotFx` into named stage processors for spawn, producer, craft, producer retry, expired effects, and wake planning.
- Split line default selection into scoped readiness, previous/default candidate lookup, mutation, and result assembly.
- Split runtime craft view assembly into recipe/job/input/effect/limit/progress route helpers.
- Clarified craft run state labels with facts + `ts-pattern.exhaustive()` instead of repeated return payloads.
- Split activation input planning into planner state plus board and inventory append routes.

## Notes

- The repeated pattern is still clear: once flows are split, duplicate state mutation/event creation routes become visible. Prefer introducing one named route for the shared mutation instead of patching each caller.
- Runtime view helpers are not Effect roots, but they still benefit from explicit route maps and named facts. Keep them pure when they only translate already-loaded state to UI, but avoid giant field-mapping functions.
