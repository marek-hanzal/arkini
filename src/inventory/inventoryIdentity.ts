import { GameConfigServiceLive } from "~/manifest/logic/GameConfigServiceLive";

export const inventoryColumns = GameConfigServiceLive.config.game.board.width;
export const inventorySlots = GameConfigServiceLive.config.game.inventory.slots;
export const inventoryRows = Math.ceil(inventorySlots / inventoryColumns);
export const inventoryContainerNodeId = "inventory-container";

export function inventorySourceId(slotIndex: number) {
	return `inventory:${slotIndex}`;
}

export function inventorySlotNodeId(slotIndex: number) {
	return `inventory-slot:${slotIndex}`;
}
