# v0 touch / long-press polish

Status: completed
Commit: TBD

Scope:

- Native browser context/callout menus are suppressed on TileEngine surfaces only.
- The game interaction surface prevents `contextmenu` through the TileEngine root handler.
- TileEngine root also disables iOS touch callout/tap highlight and declares `touch-action: none` so touch drag/long-press gestures stay in the game layer.

Notes:

- Do not apply context-menu suppression globally to the whole app. Text/forms/buttons outside game surfaces should not be broken for sport.
- This does not add new long-press behavior; it only stops the browser from hijacking existing TileEngine gestures.

Next candidates:

1. Badge/visual polish: tighten tile badge toward the corner.
2. Inventory-to-board seeded placement: long-press empty cell opens inventory with placement seed.
