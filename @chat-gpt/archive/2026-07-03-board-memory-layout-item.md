# Board memory layout item

Implemented a board-start utility item `item:board-memory` with empty/full assets. Tap on empty memory saves the current board layout, including memory items and the activated memory itself, into `save.boardMemoryLayouts[boardItemId]`. Tap on filled memory restores the stored item positions by first trying to move current board occupants into inventory, then pulling matching items from inventory back into remembered cells. Restore always clears the activated memory after one restore attempt, including partial restores, to keep the mechanic simple and one-shot. Long-press opens `BoardMemorySheet`, where the stored memory can be cleared manually.

Important behavior:
- Inventory capacity raised to 49 slots.
- Memory restore is best-effort: items that cannot move into inventory or cannot be restored due missing inventory/cell/maxCount constraints are skipped rather than failing the whole action. A best-effort restore always clears memory after the attempt, even when `restoredCount < storedCount`.
- Busy craft/producer items are not moved into inventory during restore to avoid invalid runtime job state.
- Memory item is `storage: both`; it intentionally has no `maxCount`, so players can create and stash as many layout memory devices as they want.
- Board interactions are blocked briefly after save/restore/clear events so animation cannot be interrupted by user input.
- Added events: `board.memory.saved`, `board.memory.restored`, `board.memory.cleared` and item movement reasons `memory-store` / `memory-restore`.
- Visuals: board items consumed by memory restore fly toward the activated memory item; restored board items spawn from the activated memory's operation-start position, even if that memory is itself restored to a different saved cell.
- Snapshot entries store `itemId + x/y` and preserve `itemInstanceId` for memory/runtime-state items so memory can restore itself and other filled memories without losing their stored layouts.
