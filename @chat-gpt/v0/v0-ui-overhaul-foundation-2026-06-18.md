# v0 UI overhaul foundation - 2026-06-18

Implemented the first broad UI overhaul pass after the runtime/cache cleanup.

## Done

- Removed the unused top game header from `PlayShell` so the board gets the vertical space directly.
- Added a light-mode Tailwind/CSS token set in `src/app/styles.css`:
  - page/surface/elevated/board/inventory backgrounds;
  - subtle/accent borders;
  - primary/muted text;
  - primary/secondary/success/danger/focus colors.
- Added shared lightweight CSS helpers:
  - `ak-ui-card`, `ak-ui-card-soft`, `ak-ui-eyebrow`, `ak-ui-muted`, `ak-ui-row`;
  - `ak-ui-button` plus primary/secondary/ghost/danger variants;
  - `ak-ui-progress-*` progress styles.
- Switched app background, loading screen, root error boundary, bottom nav, bottom sheet and sheet header from the old dark slate theme to the light pink/violet direction.
- Lightened board and inventory surfaces/cells with tinted backgrounds and softer borders.
- Converted item detail, craft, product-line, activation, relation and upgrade cards to lighter surfaces and shared button styles.
- Made withdraw actions materially larger (`min-height: 40px`) and marked them with `data-ui="withdraw action"`.
- Stabilized dev sheet layout: min-width guards, wrapped scenario labels/descriptions, safe pre overflow/wrapping, and lighter cards.
- Added useful `data-ui` attributes on app/game roots, board/inventory roots/cells/items, tile detail, dev sheet, scenario list, sheet header, bottom nav, store/withdraw actions and error toast.

## Important choices

This is a UI/layout/design-token task only. No gameplay logic, save schema, placement or engine rules were changed.

The task intentionally did not build a full design-system abstraction. The current shared CSS helpers are enough to remove repeated heavy dark classes while keeping the UI easy to change. Do not grow them into a component framework unless repeated real usage earns it.

Board/inventory still use TileEngine as the structural grid owner. `data-ak-tile-engine-id="board"` / `inventory` remains the grid-level identifier; `data-ui` is only added around game-specific roots and rendered cells/items.

## Follow-ups

- Manually inspect the UI in browser. Build/type/test passed, but screenshots matter for visual work because compilers have no taste, tragically.
- If the board still feels small, tune board dimensions/layout after seeing real device screenshots. Header removal already gives more vertical room.
- Continue reducing nested border cards where future UI work touches the same components. This pass got the main surfaces/card tone lighter, not perfect.
- When a proper button component appears naturally, derive it from the current `.ak-ui-button` variants rather than reintroducing random per-component button styling.
