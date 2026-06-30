# Board DnD confinement

Status: COMPLETE
Commit: f881f52

Board item drag/drop is now confined to the board system:

- Board tile drag constraints use the board surface bounds instead of the whole play area.
- The bottom inventory nav button is no longer a `TileEngineDropTarget`; board items cannot be dropped onto inventory through DnD.
- `resolveDrop` no longer has a board-source to inventory-target accept path.
- `DropActions` no longer exposes `stashBoardItem`; DnD plumbing cannot stash board items.
- Storing a board item is now an explicit action from `ItemSheet` through the `Store` button, which dispatches `board.item.stash` and closes the sheet on success.

Design rule: board DnD is board-only. Board items may move, swap, merge and interact with board cells/items. Inventory storage is an explicit detail action, not an inventory drop target. This intentionally trades ideological “everything is DnD” purity for a simpler interaction boundary, because reality is rude and edge cases enjoy knives.
