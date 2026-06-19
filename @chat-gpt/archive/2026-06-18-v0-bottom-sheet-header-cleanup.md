# v0 bottom-sheet header / violet pass - 2026-06-18

Status: completed
Commit: TBD

## Scope

Follow-up polish after the first flat UI pass, driven by screenshot review.

## Done

- Simplified `SheetHeader` to a single-title layout only:
  - removed subtitle/description support;
  - title + close button now live in one flat row;
  - tighter padding;
  - violet borders/hover states.
- Inventory sheet keeps only the `Inventory` title.
- Other sheets (`Upgrades`, `Developer`, `Item`) also use title-only headers.
- Item detail sheet title is now the actual item name instead of `Item` + subtitle.
- Empty item sheet state now uses `Nothing selected` as the single header title.
- Bottom-sheet content width/padding was aligned to the same `max-w-[430px]` rhythm as the board.
- Inventory/board TileEngine surfaces were flattened further:
  - dropped the outer border on the grid root;
  - kept the tinted grid surface;
  - inventory sheet content inset now matches the board spacing more closely.
- Shifted the active UI palette further from pink/fuchsia toward violet in the touched UI:
  - sheet chrome;
  - bottom nav;
  - item/upgrades cards;
  - progress bars;
  - badges.
- Quantity badges stay pinned at `bottom-0 right-0`.

## Notes

- This pass intentionally stayed utility-first; no new app-level visual helper CSS classes were introduced.
- Structural TileEngine CSS classes still exist because they own engine behavior/layering, not just cosmetic styling.

## Validation

- `npm install`
- `npm run format`
- `npm run typecheck`
- `npm run test`
- `npm run build`
