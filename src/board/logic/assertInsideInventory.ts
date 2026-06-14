import type { SaveShape } from "~/inventory/logic/planning/types";
import { InventorySlotIndexSchema } from "~/play/schema/InventorySlotIndexSchema";
import { GameActionError } from "~/play/logic/playTypes";

export const assertInsideInventory = (save: SaveShape, slotIndex: number) => {
	const result = InventorySlotIndexSchema.safeParse(slotIndex);
	if (!result.success || slotIndex >= save.inventorySlots) {
		throw new GameActionError("Inventory slot is outside the inventory.");
	}
};
