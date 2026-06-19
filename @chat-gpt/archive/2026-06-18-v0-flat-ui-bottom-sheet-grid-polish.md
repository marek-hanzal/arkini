# Flat UI / bottom sheet / TileEngine grid polish

2026-06-18 follow-up after Marek's screenshot review.

Changed direction:

- Page/body background is now flat white. The old radial page gradients are gone.
- Removed the custom visual utility classes for app UI (`ak-ui-*`, `ak-game-width`, bottom sheet/nav classes, layer helper classes). Component styling now uses Tailwind utility classes directly. Low-level TileEngine classes remain because they are the generic engine DOM/CSS contract for data-driven drag/drop and presence-motion selectors.
- Removed UI shadows and gradient fills from the touched surfaces, buttons, progress bars, bottom sheet, bottom nav, board/inventory surfaces and item badges.
- Sheet header padding is tighter, and the close control is a compact top-right `✕` button.
- Inventory sheet content uses a direct `w-full max-w-[430px]` wrapper and flat grid surface.
- Inventory and board grid visuals now use one outer TileEngine border with tinted grid gap background and flat white cells, avoiding the inventory double-border look.
- Tile quantity/level badges are aligned to `bottom-0 right-0`.
- TileEngine actor positioning now matches CSS grid gaps with `calc((100% - gaps) / columns)` instead of percentage cells plus padding. This fixes the subtle tile-vs-cell misalignment and right-edge clipping.

Validation:

- `npm run format:check` passes, with only the known large generated `game/arkini.assets.json` Biome warning.
- `npm run dc` passes.
- `npm run typecheck` passes.
- `npm run test` passes: 41 files / 222 tests.
- `npm run game:validate -- game/arkini` passes.
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json` passes.
- `npm run build` passes, with the known Vite large chunk warning.

Note: trying to use headless Chromium for a local visual screenshot hit the container/browser policy page (`localhost is blocked`). No browser screenshot was used as acceptance evidence in this pass, because apparently even pixels need corporate governance now.
