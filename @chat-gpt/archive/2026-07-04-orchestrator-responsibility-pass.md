# 2026-07-04 Orchestrator responsibility pass

## Scope

Continued the codeguide-driven cleanup after the single-responsibility pass. Focus was long/cyclomatic orchestrators, Effect context usage to reduce prop drilling, and `ts-pattern` dispatch where exhaustive domain coverage helps.

## Changes

- Split producer line start readiness into small `Fx` steps backed by `LineStartReadinessScopeFx` context.
- Split world snapshot validation into per-check `Fx` readers backed by `WorldSnapshotValidationScopeFx` context.
- Split audio event-to-sound mapping into batch facts, static sound dispatch, and event-specific handlers with exhaustive `ts-pattern` coverage for non-static events.
- Split engine visual plan dispatch into mutable plan context plus event-specific handlers; ignored events are explicitly guarded and handled events keep exhaustive pattern matching.
- Split producer completion into explicit `Fx` steps for live job lookup, line validation, delivery placement, placement failure handling, blocked retry handling, success charge/depletion effects, and final result assembly.

## Notes

- The producer completion refactor briefly exposed why large orchestrators are dangerous: depleted source-cell replacement needs to return both modified placement events and charge/removal events. That is now separated in `readPlacementSuccessEffectsFx`.
- Runtime behavior is preserved by existing producer, stash, capacity, visual, audio, world validation, and full standalone test suites.

## Verification

- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run audit:optional`
- `npm run build`

`npm run check` reached the Vitest phase after passing earlier steps but timed out in the sandbox output window. The standalone `npm run test` completed successfully: 101 test files / 619 tests.
