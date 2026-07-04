# Logic folder removal pass - 2026-07-04

Continued the senior duplicate-route / Fx-boundary review after `e5cd41f1`.

## Goals

- Remove the remaining vague `src/*/logic` folders and keep domain action/effect modules in concrete domain roots.
- Convert repeated board-cell checks into shared board Fx routes instead of ad-hoc scans in action paths.
- Tighten repo audit so the `./logic` folder smell cannot creep back in with a nice little fake moustache.

## Changes

- Moved remaining board, inventory, and debug Fx modules out of `src/board/logic`, `src/inventory/logic`, and `src/debug/logic` into their owning domain roots.
- Added `assertBoardCellInsideBoundsFx` for shared board bounds rejection.
- Added `readBoardItemAtCellFx` for shared board-cell occupancy lookup.
- Reused shared board-cell helpers from board item move readiness, exact inventory placement readiness, and board memory restore checks.
- Removed the local board item count/occupied routes from board memory in favor of shared board primitives.
- Replaced the old audit that merely inspected `logic` contents with a hard audit failure for any `src/**/logic/**` path.
- Updated `@chat-gpt/README.md` stale `src/board/logic` note to point at the current board view helpers.

## Validation

- `npm run audit:current` passed.
- `npm run game:validate -- game/arkini` passed with the expected finite-deposit softlock warnings for `item:double-tree`, `item:micro-forest`, `item:rock`, and `item:tree`.
- `npm run typecheck` passed.
- `npm run test` passed: 101 files / 619 tests.
- `npm run check` reached the same final Vitest stage after passing format, audit, schema, validation, dependency cruiser, and typecheck, but the tool wrapper timed out while Vitest was still streaming. The standalone Vitest run above completed cleanly.
