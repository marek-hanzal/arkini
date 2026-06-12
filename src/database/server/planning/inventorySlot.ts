import type { ItemId } from "~/manifest/server";
import { createVirtualId } from "./virtualId";
import type { InventoryPlacementPlan, InventoryRow, SaveShape } from "./types";

export function planEmptySlotPlacement(save: SaveShape, inventory: InventoryRow[], itemId: ItemId | string, slotIndex: number): InventoryPlacementPlan[] | null {
  if (slotIndex < 0 || slotIndex >= save.inventorySlots) return null;
  if (inventory.some((stack) => stack.slotIndex === slotIndex)) return null;

  const stackId = createVirtualId("inventory:virtual");
  inventory.push({ id: stackId, itemDefinitionId: itemId, slotIndex, quantity: 1 });

  return [{ type: "insert", stackId, slotIndex, itemId: itemId as ItemId, quantity: 1 }];
}
