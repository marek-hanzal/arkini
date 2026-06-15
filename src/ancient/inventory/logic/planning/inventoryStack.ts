import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/manifestId";
import { emptyInventoryStateJson } from "~/inventory/logic/emptyInventoryStateJson";
import { isEmptyInventoryStateJson } from "~/inventory/logic/isEmptyInventoryStateJson";
import { getPlanItem } from "./itemLookup";
import type { InventoryPlacementPlan, InventoryRow } from "./types";

export function planStackPlacement(
	inventory: InventoryRow[],
	itemId: ItemId | string,
	gameConfig: GameConfigService,
	quantity = 1,
	stateJson = emptyInventoryStateJson,
): InventoryPlacementPlan[] | null {
	if (quantity <= 0) return [];
	if (!isEmptyInventoryStateJson(stateJson)) return null;

	const item = getPlanItem(itemId, gameConfig);
	let remaining = quantity;
	const plan: InventoryPlacementPlan[] = [];
	const stacks = [
		...inventory,
	]
		.sort((a, b) => a.slotIndex - b.slotIndex)
		.filter(
			(row) =>
				row.itemDefinitionId === itemId &&
				isEmptyInventoryStateJson(row.stateJson) &&
				row.quantity < item.maxStackSize,
		);

	for (const stack of stacks) {
		const add = Math.min(remaining, item.maxStackSize - stack.quantity);
		if (add <= 0) continue;
		stack.quantity += add;
		remaining -= add;
		plan.push({
			type: "update",
			stackId: stack.id,
			slotIndex: stack.slotIndex,
			itemId: itemId as ItemId,
			quantity: stack.quantity,
			stateJson: emptyInventoryStateJson,
		});
		if (remaining <= 0) return plan;
	}

	return plan.length > 0 ? plan : null;
}
