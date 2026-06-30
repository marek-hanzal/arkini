# 2026-06-28 craft realtime movement pass

Focus: align craft target movement/swap behavior with producer movement semantics.

## What changed

- Running craft targets may now move and swap on the board. Craft jobs follow `targetItemInstanceId`, not fixed coordinates.
- Craft jobs now support `pausedAtMs` + `remainingMs`, matching producer pause semantics where it matters.
- Realtime craft sync pauses running craft jobs when current requirements/proximity break after movement/swap/load/tick, resumes them when requirements return, and preserves frozen progress from the moment of pause.
- Craft timing now uses proximity duration requirements consistently when starting, syncing, world fact reporting, wake planning, and UI rendering.
- Runtime craft UI exposes a `paused` phase and freezes progress/remaining time at `pausedAtMs`.
- Inline craft proximity requirements are now accepted by config schema and audited like other requirement references.
- Shared `syncRealtimeWorldJobsFx` wraps producer + craft realtime normalization so runtime adapter create/replace does not duplicate the sync sequence.
- Pausable producer/craft save timing validation now shares one schema helper.

## Validation notes

- Targeted runtime/UI/schema tests cover craft target move, swap, pause/resume after proximity break/return, paused craft UI, craft proximity duration view, inline craft proximity schema, and duplicate proximity distance handling.
- Full Vitest suite passes: 69 files, 463 tests.
- Format check, game config validation, dependency cruiser, typecheck, dead-code audit, and duplicate-code audit pass.
- `npm run check` wrapper reaches the Vitest phase but can time out in this sandbox output mode; the same individual steps pass.
