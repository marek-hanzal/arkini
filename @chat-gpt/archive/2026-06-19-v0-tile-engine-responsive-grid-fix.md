# v0 TileEngine responsive grid sizing fix - 2026-06-19

Status: completed
Commit: TBD

## Problem

The first `container="responsive"` implementation made the board wrapper responsive, but the CSS grid rows were still implicit. That allowed the slot grid to keep auto-sized rows while the TileEngine root had extra height, creating ugly horizontal bands and visually uneven rows. Classic CSS grid nonsense, because apparently rectangles need philosophical supervision.

## Fix

- `TileEngineSlots` now receives `rowCount` and sets `gridTemplateRows: repeat(rowCount, minmax(0, 1fr))`.
- `TileEngine` responsive mode now measures its parent with `ResizeObserver` and computes exact width/height from `columns / rowCount`.
- The responsive engine root is explicitly sized and centered by its parent, so every slot/actor uses the same dimensions and the whole grid stays centered when the viewport is smaller.
- Static mode is unchanged for inventory-style grids: width-driven, aspect-ratio controlled, parent scroller owns overflow.

## Validation

- `npm run format`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run game:validate -- game/arkini`
- `npm run dc`
