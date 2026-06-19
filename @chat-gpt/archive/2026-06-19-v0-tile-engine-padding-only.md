# v0 tile-engine padding-only frame - 2026-06-19

Status: completed
Commit: TBD

## Scope

Follow-up to the tile frame pass after screenshot review.

## Done

- Removed the decorative outer border/fill from the TileEngine root.
- Kept a literal root `p-1` so the grid is offset from the surrounding container.
- Kept the between-cell separator behavior owned by the grid gap/background, not by individual tile/cell borders.
- Adjusted the responsive CSS frame math from padding+border to padding-only.
- No JS sizing, no observer, no layout measurement.

## Validation

- npm run format
- npm run typecheck
- npm run test
- npm run build
- npm run game:validate -- game/arkini
- npm run dc
