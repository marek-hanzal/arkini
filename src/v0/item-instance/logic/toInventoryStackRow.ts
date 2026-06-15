import type { ItemInstanceRowSchema } from "~/v0/item-instance/type/ItemInstanceRowSchema";
import { InventoryStackRowSchema } from "~/v0/inventory/schema/InventoryStackRowSchema";

export const toInventoryStackRow = (row: ItemInstanceRowSchema.Type) => {
	if (row.locationKind !== "inventory" || row.inventorySlotIndex === null) {
		throw new Error(`Item instance ${row.id} is not an inventory stack.`);
	}

	return InventoryStackRowSchema.parse({
		id: row.id,
		saveGameId: row.saveGameId,
		slotIndex: row.inventorySlotIndex,
		itemDefinitionId: row.itemDefinitionId,
		quantity: row.quantity,
		stateJson: row.stateJson,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
};
