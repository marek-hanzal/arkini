import { GameActionError } from "~/v0/play/action/GameActionError";
import type { SaveShape } from "~/v0/play/save/model/SaveShape";

export function assertInsideInventory(save: SaveShape, slotIndex: number) {
	if (slotIndex < 0 || slotIndex >= save.inventorySlots) {
		throw new GameActionError("Inventory slot is outside the inventory.");
	}
}
