# v0 board/inventory domain extraction

Date: 2026-06-19
## Context

`src/v0/game/engine/fx` was still holding board move/swap helpers, inventory slot swap helpers, and inventory-to-board placement readiness. These are domain behaviors, not engine orchestration.

## Change

Moved board action helpers to top-level `src/v0/game/board`:

- `checkBoardItemMoveReadinessFx.ts`
- `checkBoardItemsSwapReadinessFx.ts`
- `moveBoardItemFx.ts`
- `swapBoardItemsFx.ts`
- `readBoardItemCell.ts`

Moved inventory slot swap helpers to top-level `src/v0/game/inventory`:

- `checkInventorySlotsSwapReadinessFx.ts`
- `swapInventorySlotsFx.ts`

Moved inventory-to-board placement readiness to `src/v0/game/placement`:

- `checkInventoryItemPlaceReadinessFx.ts`

## Guardrail

Do not use `engine/fx` as a bucket for action helpers. `game/engine` should orchestrate actions/ticks and import domain behavior from top-level `game/*` domains.

This was a behavior-preserving move only.
