# 2026-07-04 TileEngine mobile square sizing

Fixed mobile board/tile sizing drift.

## Decisions

- Responsive TileEngine containers now measure their parent with `ResizeObserver` and compute an exact square cell size from available width, available height, row count, column count, and gap.
- The responsive root gets explicit pixel width/height derived from square cells instead of relying only on a plain aspect-ratio formula. This keeps board aspect correct while preserving square tiles on narrow mobile viewports.
- Slot grid and actor layer now use the same CSS grid template and gap. Actors are positioned as grid children rather than with separate absolute `left/top/width/height` formulas, so tile visuals and drop hitboxes share browser layout/rounding instead of slowly diverging toward lower rows.
- Static TileEngine containers keep the previous aspect-ratio behavior for inventory/sheet usage.

## Validation

- Added `readTileEngineResponsiveSize` coverage for width-limited and height-limited boards.
- `npm run test` passes: 101 files / 606 tests.
- `npm run check` passes every pre-test stage, but the combined command still times out in this container during the final all-in-one Vitest stage. The standalone full Vitest run passes.
