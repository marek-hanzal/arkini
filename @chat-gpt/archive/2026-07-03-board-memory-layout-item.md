# Board memory layout item

Implemented a board-start utility item `item:board-memory` with empty/full assets. Tap on empty memory saves the current board layout (all board items except the memory item itself) into `save.boardMemoryLayouts[boardItemId]`. Tap on filled memory restores the stored item positions by first trying to move current board occupants into inventory, then pulling matching items from inventory back into remembered cells. Restore always clears the stored memory after one restore attempt, including partial restores, to keep the mechanic simple and one-shot. Long-press opens `BoardMemorySheet`, where the stored memory can be cleared manually.

Important behavior:
- Inventory capacity raised to 49 slots.
- Memory restore is best-effort: items that cannot move into inventory or cannot be restored due missing inventory/cell/maxCount constraints are skipped rather than failing the whole action. A best-effort restore always clears memory after the attempt, even when `restoredCount < storedCount`.
- Busy craft/producer items are not moved into inventory during restore to avoid invalid runtime job state.
- Memory item is `storage: board` and `maxCount: 2`.
- Board interactions are blocked briefly after save/restore/clear events so animation cannot be interrupted by user input.
- Added events: `board.memory.saved`, `board.memory.restored`, `board.memory.cleared` and item movement reasons `memory-store` / `memory-restore`.
- Visuals: board items consumed by memory restore fly toward the memory item; restored board items spawn from memory via existing `item.created` enter motion.

Known tradeoff:
- Restore currently stores only `itemId + x/y`, not exact instance IDs, by design per request that memory is a position preset. Runtime state is not snapshotted.
