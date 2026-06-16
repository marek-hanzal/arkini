# v0 animation follow-up

Status: DONE

## Goal

Fix the regressions reported after the cancellable TileMotionRuntime pass: merge fade should start as one parallel visual event instead of waiting behind a source snap, stash clicks must surface activation failures instead of silently doing nothing, and producer output should drip items one-by-one like stash exhaust output.

## Changes

- Added `parallel-merge` as a generic TileEngine drop animation hint.
- Board merge drops now use `parallel-merge`, so TileEngine commits the merge visual patch immediately instead of first running a separate snap-to-target animation and only then starting merge fade. This keeps merge-out transients and merge-in result motion in the same visual batch.
- Producer activation output now uses explicit `sequence` fade-in events, matching stash exhaust output timing instead of dumping the whole batch into cache at once.
- Board activation tap mutations now receive the shared feedback surface and call `feedback.showError(error)` on failure.
- Removed the UI-side early return for empty/depleted stash clicks, so a bad stash click is reported by the domain mutation instead of disappearing into the void like a tiny UI crime scene.

## Validation

- `npm run typecheck`
- `npm run test`
