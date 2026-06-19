# v0 CSS tile-engine frame pass - 2026-06-19

Status: completed
Commit: TBD

## Scope

Small visual/geometry pass after the bottom-nav icon cleanup.

## Done

- Added a very subtle inner TileEngine frame:
  - `border-white/[0.04]`
  - `p-0.5`
  - no extra duplicated inventory padding beyond the existing sheet body inset.
- Removed the JS/ResizeObserver sizing path from TileEngine responsive sizing.
- Moved responsive TileEngine sizing back into CSS:
  - the board surface is a CSS size container;
  - responsive TileEngine uses `cqw`/`cqh` container units plus the known grid ratio;
  - static TileEngine stays width-driven for inventory.
- Kept the actual grid frame aspect-ratio inside the padded TileEngine shell so slot and actor geometry stay aligned.

## Notes

TileEngine still uses React state for drag/drop feedback. The sizing itself is CSS-only now; no observer, no measured dimensions, no browser-layout fortune telling. Tiny mercy.

## Validation

- npm run format
- npm run typecheck
- npm run test
- npm run build
- npm run game:validate -- game/arkini
- npm run dc
