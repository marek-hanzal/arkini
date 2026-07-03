# 2026-07-04 Board memory, cheat delete, config and UI fixes

Implemented task batch from `arkini-board-capacity-refresh-32002781.zip`.

## Decisions

- Board memory restore must not use inventory as a universal scratch space. Items that cannot be stored in inventory, especially `item:inventory`, are now restored by board layout using their existing board instance.
- Cheat inventory board tile is a delete target. Dropping a board item onto `item:cheat` dispatches `debug.board_item.delete` and removes the source item from the board instead of storing it.
- Non-producer item removals now use a dedicated tile-engine exit kind `remove`. Producer/stash depletion still uses the retained-tile `merge-out` timing.
- Product lines whose effective output target maxCount is already reached are hidden when idle, but kept visible while a job is still active.
- Craft details now expose and render missing start requirements from craft effects so disabled craft/start buttons are not mystery meat.

## Config changes

- Removed `item:food-supply`; kept `item:feast` as the food master item and rewired old Food Supply references to Feast.
- Deleted obsolete `game/arkini/assets/item-food-supply.png`.
- Beer barrel production lines now require `item:plank`.
- Farm grain production lines now require 2 water buckets.

## Validation notes

- `npm run check` passes all pre-test stages but the all-in-one Vitest invocation timed out in this container.
- Verified the full test suite in two batches: first 50 test files and second 50 test files, all passed.
