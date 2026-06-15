import type { SaveShape } from "~/v0/play/save/model/SaveShape";
import { InventorySlotIndexSchema } from "~/v0/inventory/schema/InventorySlotIndexSchema";
import { GameActionError } from "~/v0/play/action/GameActionError";

export const assertInsideInventory = (save: SaveShape, slotIndex: number) => {
	const result = InventorySlotIndexSchema.safeParse(slotIndex);
	if (!result.success || slotIndex >= save.inventorySlots) {
		throw new GameActionError("Inventory slot is outside the inventory.");
	}
};
