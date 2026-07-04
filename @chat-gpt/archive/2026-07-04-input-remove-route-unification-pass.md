# Input/remove route unification pass - 2026-07-04

Follow-up deep quality pass focused on duplicate routes, long Fx execution bodies, and UI interaction maps that were still mentally expensive to follow.

## Done

- Added shared single-input-ref helpers:
  - `resolveSingleInputRefFx`
  - `assertResolvedInputRefIsNotBoardItemFx`
  - `assertResolvedInputRefQuantityFx`
- Replaced repeated one-ref resolution and self-target/quantity guards in merge, tile remove, craft input store, and producer input store readiness.
- Shared stored-input mutation/event paths for manual store and autofill:
  - `storeCraftResolvedInputFx`
  - `storeProducerResolvedInputFx`
- Split producer input store readiness into target, resolved input, candidate line selection, line accessibility, line capacity, and accepted candidate steps under a scoped Fx context.
- Split craft input store readiness into target/idle check, resolved input, slot lookup, and capacity steps under a scoped Fx context.
- Split merge readiness into target, source, executable rule, result item existence, max-count capacity, and replaceable-target assertions.
- Split tile remove readiness and removed its manual producer/craft job scans in favor of shared board runtime state status facts.
- Split tile removal execution into tool consumption, working save creation, board removal, loot roll, output placement, and result assembly.
- Split craft/producer input storage execution bodies into readiness, working state, stored result, and optional craft auto-start phases.
- Clarified board tap routing by separating special items, craft, stash, producer, and fallback item-sheet routes.
- Clarified item-to-board-item interaction planning by first building named interaction facts, then routing to merge/craft/stash/remove/producer/swap plans.

## Verification

- `npm run format:check` passed.
- `npm run audit:current` passed.
- `npm run game:schema:check` passed.
- `npm run game:validate -- game/arkini` passed with only known limited-deposit warnings.
- `npm run dc` passed.
- `npm run typecheck` passed.
- `timeout 180s npm run test` passed: 101 files / 619 tests.
- `npm run audit:optional` passed: no unused exports / no duplicates.
- `npm run build` passed with the known Vite chunk-size warning.
