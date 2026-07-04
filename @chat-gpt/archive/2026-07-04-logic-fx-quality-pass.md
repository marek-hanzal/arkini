# 2026-07-04 Logic Fx quality pass

A follow-up deep review after `42b37f82`, focused on eliminating accidental pure value exports from `src/**/logic`, removing pointless imported aliases, and moving impure/domain boundary work toward Effect.

## Fixed

- Moved pure view/control/model helpers out of `logic` folders so `logic` no longer acts as a miscellaneous dumping ground.
- Moved board/inventory/item-detail/producer/craft UI derivation helpers into `view`, `control`, or `model` modules depending on their actual role.
- Removed the standalone `randomFloat` wrapper and embedded randomness inside `RandomServiceLive`.
- Converted board runtime reads used by engine decisions to `readBoardItemCellFx` and `readBoardItemMaxCountCapacityFx`, then updated call sites to yield through the Effect pipeline.
- Moved hashing to `sha256Fx` and `hashRuntimeGameConfigFx`, so async crypto does not masquerade as plain logic.
- Removed remaining pure exports from `src/**/logic` and added an audit rule requiring exported value exports in logic folders to end with `Fx`.
- Converted `GameEngineError` factories to real `Data.TaggedError` classes while keeping the public discriminated union and factory object stable.
- Hid the internal tagged error classes so optional export audit stays clean.
- Removed trivial imported aliases such as `const boardView = rebuildBoardView` and `const durationMs = tileRemoveDurationMs`.
- Removed stale config/test aliases that only renamed imported or nearby values without adding behavior.

## Guardrails

- `audit:current` now rejects exported non-Fx values from `src/**/logic` files.
- Existing audits still reject redundant schema type aliases, impure cuid2 generation outside Fx files, duplicated code, unused exports, and non-Fx named exported `Effect.fn` values.

## Verification

`npm run check` passes end-to-end: format, active audit, schema check, game validation, dependency cruise, typecheck, and all Vitest suites.

`npm run audit:optional` passes with no unused export or duplicate-code findings.

`npm run build` passes. Vite still warns about chunk size, which remains a warning rather than a build failure.

Expected game validation warnings remain for limited finite deposits without sustainable replacement paths: `item:double-tree`, `item:micro-forest`, `item:rock`, and `item:tree`.
