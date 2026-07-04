# 2026-07-04 — Inventory/event Fx unification pass

Follow-up senior deep-review pass after `5e22bb15`, focused on removing leftover vague implementation routes after the `src/**/logic` folder removal.

## Changed

- Renamed `src/play/runtime/createPersistentGameRuntimeStore.ts` to `createPersistentGameRuntimeStoreFx.ts` so exported `Effect.fn` boundaries are visible from the filename, not just the symbol name.
- Tightened `audit:current` so exported `Effect.fn` values must live in `Fx`-suffixed files.
- Added shared board/inventory event builders:
  - `src/board/createBoardItemConsumedEventFx.ts`
  - `src/placement/pushBoardItemCreatedEventFx.ts`
- Reused existing placement inventory creation plumbing from board-memory restore/store paths instead of hand-rolling stack placement and events locally.
- Added `src/inventory/consumeInventorySlotQuantityFx.ts` and routed activation input consumption and inventory-to-board placement through it.
- Kept inventory instance runtime-state behavior explicit with `runtimeState: "remove-instance" | "preserve-instance"`, because activation consumes instances destructively while board placement transfers them back to the board.

## Notes

- `src/**/logic` remains gone.
- Board-memory still owns the memory save/restore orchestration, but low-level inventory stack placement and created/consumed event construction no longer have private copies inside it.
- This pass intentionally did not create a generic `fx/` bucket. Domain folders stay primary; `Fx` marks the Effect boundary.

## Verified during pass

- `npm run format:check`
- `npm run audit:current`
- `npm run dc`
- `npm run typecheck`
- Targeted Vitest slices for board-memory, stash, placement, activation, and board/inventory actions.
