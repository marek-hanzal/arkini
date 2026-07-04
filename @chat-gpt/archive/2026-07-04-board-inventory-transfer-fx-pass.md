# 2026-07-04 — Board/inventory transfer Fx pass

Follow-up brutal deep-review pass after `aa1fd356`, focused on duplicate board-item-to-inventory routes and leftover dead placement plumbing.

## Changed

- Added `src/placement/placeBoardItemInInventoryFx.ts` as the single board item -> inventory transfer primitive.
  - Preserves runtime state for stateful board instances.
  - Converts stateless board items back into inventory stacks.
  - Emits the consumed event before inventory-created events to preserve existing visual/event order.
  - Validates item existence and inventory storage through the shared config/storage path.
- Routed `stashBoardItemFx` through the shared transfer Fx instead of keeping private preserve-instance and stack-copy placement flows.
- Routed board-memory store through the shared transfer Fx instead of hand-rolling board consumed events, inventory created events, runtime-state deletion, and stack placement locally.
- Routed board-memory restore inventory consumption through `consumeInventorySlotQuantityFx` so memory restore no longer mutates inventory slots and creates consumed events through a private parallel path.
- Removed dead `src/placement/placeGameSaveInventoryItemsFx.ts`; after the stash route cleanup it had no callers and was a stale alternate inventory placement API.

## Notes

- `src/**/logic` remains gone.
- Board-memory still owns layout orchestration, but no longer owns low-level board->inventory transfer or inventory consumption mechanics.
- Stash remains the player-facing action boundary; the shared placement Fx is deliberately lower-level and mutates the supplied save/events like other placement primitives.

## Verified during pass

- `npm run format:check`
- `npm run audit:current`
- `npm run audit:dead`
- `npm run audit:dupes`
- `npm run dc`
- `npm run typecheck`
- Targeted Vitest slices for board-memory, stash, debug spawn, placement, and board/inventory actions.
