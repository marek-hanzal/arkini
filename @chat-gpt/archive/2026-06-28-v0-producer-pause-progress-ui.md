# V0 Producer pause progress UI fix

## Context

A running producer with requirements correctly pauses when its requirement disappears from the board and resumes when the requirement returns. The runtime snapshot keeps the job stable through `pausedAtMs` and `remainingMs`.

## Finding

The engine was preserving progress correctly. The visible jump/reset came from the UI live clock: `useLiveNowMs` stopped ticking after the original `readyAtMs`, so if a producer stayed paused beyond that old deadline, the first resumed render could use a stale `nowMs`. The resumed job already had the correct shifted `startAtMs`/`readyAtMs`, but the stale UI clock made progress look wrong for the first frame/tick.

## Fix

- `useLiveNowMs` now re-anchors `nowMs` immediately whenever the active timer key changes, using a browser layout effect to avoid painting one stale progress frame after resume.
- Paused producer product lines now render as `Paused`, not `Queue full`/`Running`.
- Remaining time for paused lines is computed from `pausedAtMs`, so it stays frozen until resume.
- Added a UI regression test for paused producer product line rendering.

## Validation

- `npm run check` passed.
- Full test suite: 68 files, 447 tests passed.
- Game config validation: valid, 211 items and 173 resources.
- Dependency cruiser: no violations.
