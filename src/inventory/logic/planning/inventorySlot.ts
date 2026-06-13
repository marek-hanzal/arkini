import type { IdService } from "~/id/context/IdServiceFx";
import type { ItemId } from "~/manifest/data/manifestId";
import type { InventoryPlacementPlan, InventoryRow, SaveShape } from "./types";

export function planEmptySlotPlacement(
	save: SaveShape,
	inventory: InventoryRow[],
	itemId: ItemId | string,
	slotIndex: number,
	id: IdService,
): InventoryPlacementPlan[] | null {
	if (slotIndex < 0 || slotIndex >= save.inventorySlots) return null;
	if (inventory.some((stack) => stack.slotIndex === slotIndex)) return null;

	const stackId = id.inventoryVirtual();
	inventory.push({
		id: stackId,
		itemDefinitionId: itemId,
		slotIndex,
		quantity: 1,
	});

	return [
		{
			type: "insert",
			stackId,
			slotIndex,
			itemId: itemId as ItemId,
			quantity: 1,
		},
	];
}
