import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/data/manifestId";
import { getPlanItem } from "./itemLookup";
import type { InventoryPlacementPlan, InventoryRow } from "./types";

export function planStackPlacement(
	inventory: InventoryRow[],
	itemId: ItemId | string,
	gameConfig: GameConfigService,
): InventoryPlacementPlan[] | null {
	const item = getPlanItem(itemId, gameConfig);
	const stack = [
		...inventory,
	]
		.sort((a, b) => a.slotIndex - b.slotIndex)
		.find((row) => row.itemDefinitionId === itemId && row.quantity < item.maxStackSize);

	if (!stack) return null;

	stack.quantity += 1;
	return [
		{
			type: "update",
			stackId: stack.id,
			slotIndex: stack.slotIndex,
			itemId: itemId as ItemId,
			quantity: stack.quantity,
		},
	];
}
