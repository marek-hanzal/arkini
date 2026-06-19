# V0 item storage policy

Implemented item-level `storage` policy in `GameConfig`: `board`, `inventory`, or `both` with `both` as the default.

Runtime behavior:

- Board-only items cannot be stashed into inventory.
- Inventory-only items cannot be placed onto board cells.
- `board_then_inventory` output placement respects storage policy: inventory-only output skips board, board-only output never falls back to inventory.
- Central `GameSaveConfigSchema` rejects board/inventory locations that violate item storage.
- Starting state validation rejects board-only inventory entries and inventory-only board entries.
- Item catalog view exposes storage so UI can disable the Store action for board-only tiles.

Reason codes:

- Action readiness uses `storage_restricted` for direct player actions.
- Placement helpers can fail with `storage:inventory-forbidden` when an inventory-only sink is requested for a board-only item.
