# 2026-07-04 — Realtime/input/merge responsibility pass

Continued the single-responsibility and Effect-context cleanup from `64937115`.

## Changed

- Added `src/save/GameSaveDraftScopeFx.ts` as shared lazy draft-save context for Effect programs that should only clone a `GameSave` when a mutation is actually needed.
- Split realtime craft sync into small Effect steps with `CraftRealtimeSyncScopeFx` and `GameSaveDraftScopeFx`.
- Split realtime producer sync into run/queue contexts, small delivery/paused/timing handlers, and `ts-pattern` dispatch.
- Split craft completion into validation, blocked retry/failure, and successful replacement steps behind `CraftJobCompletionScopeFx`.
- Split activation input ref resolution/consumption into board/inventory Effect handlers with context-owned state instead of long mixed loops.
- Split merge execution into readiness, source consumption, replacement, output rolling, output placement, and result assembly under `MergeItemScopeFx`.

## Notes

- The shared lazy draft scope removed duplicated `ensureNextSave` closures from realtime producer/craft sync.
- Producer sync had a redundant `shouldCheckStartGate` branch; behavior reduces to `startAtMs <= nowMs`.
- No gameplay compatibility paths were added.

## Verified

- `npm run audit:current`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run format:check`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run audit:optional`
- `npm run build`

`npm run check` reached Vitest and then timed out in the sandbox, while standalone `npm run test` passed before that.
