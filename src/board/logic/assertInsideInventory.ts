import type { SaveShape } from "~/inventory/logic/planning/types";
import { InventorySlotIndexSchema } from "~/play/schema/InventorySlotIndexSchema";
import { GameActionError } from "~/command/GameActionError";

export const assertInsideInventory = (save: SaveShape, slotIndex: number) => {
	const result = InventorySlotIndexSchema.safeParse(slotIndex);
	if (!result.success || slotIndex >= save.inventorySlots) {
		throw new GameActionError("Inventory slot is outside the inventory.");
	}
};
