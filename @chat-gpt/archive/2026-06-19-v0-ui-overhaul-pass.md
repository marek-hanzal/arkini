# v0 UI overhaul pass - 2026-06-19

Status: completed
Commit: TBD

## Scope

Broad visual cleanup pass after the darker palette correction.

Main goal:

- keep the dark pink/violet direction,
- make the game field more legible,
- modernize the shell/sheets/cards,
- and make TileEngine sizing explicit through a container mode.

## Done

### TileEngine container sizing

Added a first-class `container` prop to `TileEngine`:

- `responsive` — board-style layout; the engine uses available height, preserves the grid aspect ratio, and centers cleanly.
- `static` — sheet/inventory layout; width is driven by the container and vertical overflow is handled by the surrounding scroller.

Also added `rootRef` so the actual visual engine bounds can be reused for drag constraints.

### Board / inventory layout

- Board now uses `container="responsive"`, so the playable grid scales by height instead of feeling like a tiny island.
- Inventory now uses `container="static"` inside a scrolling sheet body.
- Added/kept useful `data-ui` markers around the major layout surfaces.

### Shell / navigation / sheets

- Bottom navigation got a flatter, clearer button treatment with visible labels.
- Sheet header spacing was tightened and normalized.
- Bottom sheet dimensions were slightly relaxed (`--ak-sheet-width`, `--ak-sheet-max-height`).

### Shared UI primitives

Added tiny shared building blocks:

- `UiButton`
- `UiSection`

These are plain Tailwind-based components used to normalize repeated sheet/card/button styling without bringing back custom CSS utility soup.

### Sheet / card cleanup

Touched the main high-use UI surfaces:

- `DevSheet`
- `UpgradesSheet`
- `ItemSheet`
- `UpgradeCard`
- item detail cards (summary, craft, activation, producer lines, relations)

The result is flatter and simpler:

- subtler borders,
- more consistent spacing,
- fewer noisy nested boxes,
- stronger typography hierarchy,
- unified action buttons.

### Token tuning

Minor palette/layout token tune-up:

- slightly adjusted elevated/border surfaces,
- slightly taller bottom nav,
- wider/taller sheet allowances.

## Validation

- `npm install`
- `npm run format`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Notes

This was intentionally a broad presentation/layout pass only.
No gameplay rules, save semantics, placement rules, or runtime engine logic were changed.
