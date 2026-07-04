# Inventory slot boundary pass

- Added `src/inventory/writeInventorySlotFx.ts` as the single low-level inventory slot write boundary.
- Routed inventory instance placement, stack remainder placement, inventory consumption, and slot swap through that boundary.
- Replaced direct stack `slot.quantity += ...` mutation with an explicit replacement slot write.
- Extended `audit:current` so production `inventory.slots[...] =`, `slots[...] =`, and direct stack quantity mutation are rejected outside the boundary.
- Scope: no behavior change intended; this is lifecycle ownership cleanup after the broader job/input/effect/runtime-state boundary passes.
