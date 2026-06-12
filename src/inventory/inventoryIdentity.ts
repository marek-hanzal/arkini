export const inventoryColumns = 7;
export const inventoryRows = 5;
export const inventorySlots = inventoryColumns * inventoryRows;
export const inventoryContainerNodeId = "inventory-container";
export const inventoryBinNodeId = "inventory-bin";

export function inventorySourceId(slotIndex: number) {
  return `inventory:${slotIndex}`;
}

export function inventorySlotNodeId(slotIndex: number) {
  return `inventory-slot:${slotIndex}`;
}
