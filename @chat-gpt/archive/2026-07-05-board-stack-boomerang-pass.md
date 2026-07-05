# Board stack + boomerang pass

Implemented board-side stack quantities and partial-stack activation visuals.

## Commits

- `fd8e7215 Add board stack quantities`
- `48d9d93c Add board stack boomerang visuals`

## Notes

- Board save items now support optional `quantity`, with default `1` for legacy/simple board items.
- Board counts/maxCount validations now count stack quantities, not just item instances.
- Board placement chunks by `maxStackSize` and remaining board `maxCount` capacity before spilling to inventory.
- Inventory stack placement on board now creates board stack items instead of loose single tiles.
- Activation input planning can consume partial quantities from board stacks.
- Board input consumption decrements stack quantities and only removes the source tile when fully consumed.
- Partial board-stack activation emits consumed events with `previousQuantity`/`nextQuantity` so visuals can detect boomerang flow.
- Board passive effect sources repeat by board stack quantity, matching inventory stack behavior.
- Board memory snapshots/restores preserve stack quantity only when `quantity > 1` to avoid save churn.
- Visual auto-fill now uses `boomerang-to-tile` exit motion for partial board stack consumption:
  - whole stack flies to target,
  - target receives existing feedback,
  - remainder returns to source,
  - source receives feedback after the return.
- Fully consumed board stacks keep using existing removal/disappear flow.
