import type { IdService } from "~/v0/id/context/IdServiceFx";
import { emptyInventoryStateJson } from "~/v0/inventory/logic/emptyInventoryStateJson";
import { isEmptyInventoryStateJson } from "~/v0/inventory/logic/isEmptyInventoryStateJson";
import type { GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { assertInsideInventory } from "./inventoryBounds";
import { planEmptySlotPlacement } from "./inventorySlot";
import { planStackPlacement } from "./inventoryStack";
import type { InventoryPlacementPlan, InventoryRow, SaveShape } from "./types";

export namespace planInventoryPlacement {
	export interface Options {
		gameConfig: GameConfigService;
		id: IdService;
		quantity?: number;
		stateJson?: string;
	}
}

export function planInventoryPlacement(
	save: SaveShape,
	inventory: InventoryRow[],
	itemId: ItemId | string,
	options: planInventoryPlacement.Options,
): InventoryPlacementPlan[] | null {
	const quantity = options.quantity ?? 1;
	const stateJson = options.stateJson ?? emptyInventoryStateJson;
	if (!isEmptyInventoryStateJson(stateJson) && quantity !== 1) return null;
	let remaining = quantity;
	const plan: InventoryPlacementPlan[] = [];

	if (isEmptyInventoryStateJson(stateJson)) {
		const before = new Map(
			inventory.map((row) => [
				row.id,
				row.quantity,
			]),
		);
		const stackPlan = planStackPlacement(
			inventory,
			itemId,
			options.gameConfig,
			remaining,
			stateJson,
		);
		if (stackPlan) {
			plan.push(...stackPlan);
			const added = stackPlan.reduce((sum, step) => {
				if (step.type !== "update") return sum;
				return sum + Math.max(0, step.quantity - (before.get(step.stackId) ?? 0));
			}, 0);
			remaining -= added;
		}
	}

	while (remaining > 0) {
		let inserted = false;
		for (let slotIndex = 0; slotIndex < save.inventorySlots; slotIndex += 1) {
			const insertPlan = planEmptySlotPlacement(
				save,
				inventory,
				itemId,
				slotIndex,
				options.id,
				options.gameConfig,
				remaining,
				stateJson,
			);
			if (!insertPlan) continue;
			plan.push(...insertPlan);
			remaining -= insertPlan.reduce((sum, step) => sum + step.quantity, 0);
			inserted = true;
			break;
		}
		if (!inserted) return null;
		if (!isEmptyInventoryStateJson(stateJson)) break;
	}

	return plan;
}
