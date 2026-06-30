# World snapshot final cleanup pass

Date: 2026-06-27
Commit target: final world snapshot cleanup

## What changed

- Removed dead pre-world-hub helper files:
  - `src/v0/game/job/compareGameTimedJobs.ts`
  - `src/v0/game/requirements/checkProximityRequirementFx.ts`
  - `src/v0/game/requirements/countPassiveItemQuantityFx.ts`
- Removed unused `compareGameReadyTimes` export from `GameTime.ts`.
- Made internal world status/code type aliases non-exported where they are only used inside their owning fact/issue modules.
- Added `groupWorldProducerJobs` so producer queue grouping has one normalized implementation.
- Added `readWorldProducerJobSubjectFx` so producer job target/product/requirements/hindrances lookup is centralized instead of duplicated between runtime gate logic and world requirement facts.
- Tightened active effect wake facts: an already-active effect no longer keeps an `active_effect_start` wake reason in the live snapshot report; only future scheduled starts emit start wake reasons, while end cleanup remains tracked.

## Validation notes

- `npm run audit:dead` is clean.
- `npm run audit:dupes` is clean.
- Full dot-reporter test suite passes.
- The verbose `npm run check` wrapper still times out in this execution environment during the default Vitest output phase, while its individual equivalent steps pass.
