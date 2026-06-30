# v0 tile-engine frame visibility - 2026-06-19

Status: completed
Commit: TBD

## Scope

Small visual follow-up after the CSS-only TileEngine frame pass.

## Done

- Made the TileEngine frame materially visible without turning it into a glowing rectangle.
- Increased the internal frame padding from `p-0.5` to `p-1`.
- Updated the CSS frame math from `0.25rem + 2px` to `0.5rem + 2px` so responsive sizing still accounts for padding + border.
- Moved caller-provided grid background classes from the TileEngine root onto the inner grid.
- Gave the TileEngine root a subtle contrasting frame fill, so the padding is visible as separation from surrounding page edges.
- Kept this purely CSS/layout-level; no JS measurement was added.

## Validation

- `npm run format`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run game:validate -- game/arkini`
- `npm run dc`
