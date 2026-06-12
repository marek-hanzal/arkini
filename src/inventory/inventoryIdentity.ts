import { GameConfig } from "~/manifest/data/GameConfig";

export const inventoryColumns = GameConfig.game.board.width;
export const inventorySlots = GameConfig.game.inventory.slots;
export const inventoryRows = Math.ceil(inventorySlots / inventoryColumns);
export const inventoryContainerNodeId = "inventory-container";

export function inventorySourceId(slotIndex: number) {
	return `inventory:${slotIndex}`;
}

export function inventorySlotNodeId(slotIndex: number) {
	return `inventory-slot:${slotIndex}`;
}
