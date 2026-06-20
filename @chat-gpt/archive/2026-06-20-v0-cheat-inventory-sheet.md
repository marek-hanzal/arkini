# V0 cheat inventory sheet

Completed 2026-06-20.

Implemented a dev cheat inventory sheet for quick game-flow testing.

Behavior:

- Added a `Cheats` bottom-nav sheet with all current item catalog entries.
- Single-clicking an item dispatches `debug.item.spawn` into `board` and creates one board instance in the first empty board cell.
- Double-clicking an item dispatches `debug.item.spawn` into `inventory` and adds one real stack item to the game inventory.
- Single vs double click is disambiguated with a short delayed single-click timer so double-click does not also spawn a board item.
- Sheet shows last success/error feedback inline.

Engine:

- Added typed `debug.item.spawn` action to the main `GameActionSchema` and `matchGameAction` dispatch.
- Added readiness checks for item existence, storage restrictions, board capacity, and inventory capacity.
- Board debug spawn never silently falls back to inventory when the board is full.
- Inventory debug spawn uses the existing inventory remainder placement helper, so stack behavior stays consistent.
- Debug spawns emit normal `item.created` events with reason `debug`.

Validation:

- Added engine tests for board spawn, inventory spawn, inventory stacking, and board-full rejection.
- `npm run format:check` passed with the existing `game/arkini.assets.json` size warning.
- `npm run dc` passed.
- `npm run typecheck` passed.
- `npm run test` passed: 52 files, 276 tests.
- `npm run game:validate -- game/arkini` passed.
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json` passed.
- `npm run build` passed with the existing Vite chunk-size warning.
