# v0 tile-engine visibility pass - 2026-06-18

Status: completed
Commit: TBD

## Scope

Quick follow-up after the dark-sheet pass because the board became too dark and the grid lost readability.

## Done

- Lifted the board/inventory palette slightly so the game field stays dark, but no longer disappears into near-black.
- Kept sheets dark, but nudged the global page/surface tokens a bit brighter to reduce the "black hole" feel.
- Made board and inventory cells brighter via subtle white-tinted fills so the grid reads more clearly against the tile-engine background.
- Increased a few tile-engine feedback overlays a notch so placement / readiness / blocked states stay readable on the darker board.

## Validation

- npm run format
- npm run typecheck
- npm run test
- npm run build
