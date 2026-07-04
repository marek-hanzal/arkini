# 2026-07-04 route cleanup deep pass

Follow-up deep quality pass after `c13c9c80`.

## Focus

- Continue route-map clarity cleanup in places that were mentally expensive to follow.
- Split long functions into named single-responsibility pieces.
- Prefer `ts-pattern` with `exhaustive()` where domain variants need compile-time coverage.
- Keep logic moving toward small Effect-oriented flows and avoid re-export/alias noise.

## Changes

- Split board memory activation into explicit save/restore routes, with dedicated Effect steps for inventory storage, board-only restore, inventory-backed restore, and event/result assembly.
- Split runtime drop action dispatchers so board/inventory move, swap, store, delete, and interaction flows are named handlers instead of one large action object.
- Split line run state into `LineRunFacts` plus label/status helper routes; long label chains are now smaller named functions.
- Split board tile-engine hook routing into board activation, surface slot/tile mapping, blocked cell keys, sheet opener, and drag config helpers.
- Split inventory tile-engine hook routing into surface slot/tile mapping, placement dispatch, tap placement, and drag config helpers.
- Split single item placement into Effect context-backed placement steps: definition lookup, storage checks, board target planning, board placement, inventory fallback, and failure reason selection.
- Split game action dispatch into category-level route handlers: board item, board memory, board interaction, board, inventory, craft, producer, and debug.
- Split config reference validation into asset, item own definition, merge, removal, and capability reference routes.
- Split starting state validation into inventory, board item, board position, duplicate cell, and max-count validators.

## Validation

- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run audit:optional`
- `npm run build`

The game validator still reports the expected limited deposit warnings for `item:double-tree`, `item:micro-forest`, `item:rock`, and `item:tree`.
