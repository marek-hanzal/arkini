import type { SaveShape } from "~/v0/inventory/logic/planning/types";
import { InventorySlotIndexSchema } from "~/v0/play/schema/InventorySlotIndexSchema";
import { GameActionError } from "~/v0/play/action/GameActionError";

export const assertInsideInventory = (save: SaveShape, slotIndex: number) => {
	const result = InventorySlotIndexSchema.safeParse(slotIndex);
	if (!result.success || slotIndex >= save.inventorySlots) {
		throw new GameActionError("Inventory slot is outside the inventory.");
	}
};
