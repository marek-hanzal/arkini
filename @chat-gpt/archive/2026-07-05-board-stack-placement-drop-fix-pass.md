# Board stack placement/drop fix pass

## Summary

Fixed two board-stack follow-ups after introducing board stack quantities:

1. Board output placement now fills existing matching stateless board stacks before empty cells.
2. Dragging matching stackable items onto each other now routes through `item.stack` with merge-style feedback instead of swapping.

## Details

- Added board stack placement planning via `planBoardStackItemsFx`.
- `placeSingleBoardCopiesUntilBlockedFx` can now place into an existing board stack before creating a new board item.
- Added `item.stack` runtime action for source-ref -> board-stack target movement.
- Board sources move as much of the source stack as the target can accept; leftovers stay on the source tile.
- Inventory sources still move one item per DnD application, matching existing inventory-to-board interaction semantics.
- Stack targets ignore items with runtime state (`busy` or `preservable`) so producer/craft/stateful board items are not silently merged as stacks.
- Drop interaction plan maps stackable same-item drops to merge-style feedback/animation.

## Validation notes

Ran standard audits, typecheck, build, and targeted placement/drop/runtime/audio/visual tests.
