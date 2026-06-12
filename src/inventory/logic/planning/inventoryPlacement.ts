import type { ItemId } from "~/manifest/data/manifestId";
import { assertInsideInventory } from "./inventoryBounds";
import { planEmptySlotPlacement } from "./inventorySlot";
import { planStackPlacement } from "./inventoryStack";
import type { InventoryPlacementPlan, InventoryRow, SaveShape } from "./types";

export function planInventoryPlacement(save: SaveShape, inventory: InventoryRow[], itemId: ItemId | string): InventoryPlacementPlan[] | null {
  const stackPlan = planStackPlacement(inventory, itemId);
  if (stackPlan) return stackPlan;

  for (let slotIndex = 0; slotIndex < save.inventorySlots; slotIndex += 1) {
    const insertPlan = planEmptySlotPlacement(save, inventory, itemId, slotIndex);
    if (insertPlan) return insertPlan;
  }

  return null;
}

export function planExactInventorySlotPlacement(save: SaveShape, inventory: InventoryRow[], itemId: ItemId | string, slotIndex: number): InventoryPlacementPlan[] | null {
  assertInsideInventory(save, slotIndex);

  const target = inventory.find((stack) => stack.slotIndex === slotIndex);
  if (!target) return planEmptySlotPlacement(save, inventory, itemId, slotIndex);
  if (target.itemDefinitionId !== itemId) return null;

  return planStackPlacement([target], itemId);
}

export function cloneInventory(rows: readonly InventoryRow[]) {
  return rows.map((row) => ({ ...row }));
}
