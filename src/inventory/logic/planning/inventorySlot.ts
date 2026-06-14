import type { IdService } from "~/id/context/IdServiceFx";
import {
	emptyInventoryStateJson,
	isEmptyInventoryStateJson,
} from "~/inventory/logic/inventoryState";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/data/manifestId";
import { getPlanItem } from "./itemLookup";
import type { InventoryPlacementPlan, InventoryRow, SaveShape } from "./types";

export function planEmptySlotPlacement(
	save: SaveShape,
	inventory: InventoryRow[],
	itemId: ItemId | string,
	slotIndex: number,
	id: IdService,
	gameConfig: GameConfigService,
	quantity = 1,
	stateJson = emptyInventoryStateJson,
): InventoryPlacementPlan[] | null {
	if (quantity <= 0) return [];
	if (slotIndex < 0 || slotIndex >= save.inventorySlots) return null;
	if (inventory.some((stack) => stack.slotIndex === slotIndex)) return null;

	const item = getPlanItem(itemId, gameConfig);
	const isStateful = !isEmptyInventoryStateJson(stateJson);
	const placedQuantity = isStateful ? 1 : Math.min(quantity, item.maxStackSize);
	const stackId = id.inventoryVirtual();
	inventory.push({
		id: stackId,
		itemDefinitionId: itemId,
		slotIndex,
		quantity: placedQuantity,
		stateJson,
	});

	return [
		{
			type: "insert",
			stackId,
			slotIndex,
			itemId: itemId as ItemId,
			quantity: placedQuantity,
			stateJson,
		},
	];
}
