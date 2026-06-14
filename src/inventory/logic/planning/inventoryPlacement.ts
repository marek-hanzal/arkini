import type { IdService } from "~/id/context/IdServiceFx";
import {
	emptyInventoryStateJson,
	isEmptyInventoryStateJson,
} from "~/inventory/logic/inventoryState";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/data/manifestId";
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

export namespace planExactInventorySlotPlacement {
	export interface Options {
		gameConfig: GameConfigService;
		id: IdService;
		quantity?: number;
		stateJson?: string;
	}
}

export function planExactInventorySlotPlacement(
	save: SaveShape,
	inventory: InventoryRow[],
	itemId: ItemId | string,
	slotIndex: number,
	options: planExactInventorySlotPlacement.Options,
): InventoryPlacementPlan[] | null {
	assertInsideInventory(save, slotIndex);

	const quantity = options.quantity ?? 1;
	const stateJson = options.stateJson ?? emptyInventoryStateJson;
	if (!isEmptyInventoryStateJson(stateJson) && quantity !== 1) return null;
	const target = inventory.find((stack) => stack.slotIndex === slotIndex);
	if (!target)
		return planEmptySlotPlacement(
			save,
			inventory,
			itemId,
			slotIndex,
			options.id,
			options.gameConfig,
			quantity,
			stateJson,
		);
	if (target.itemDefinitionId !== itemId) return null;
	if (!isEmptyInventoryStateJson(target.stateJson)) return null;

	return planStackPlacement(
		[
			target,
		],
		itemId,
		options.gameConfig,
		quantity,
		stateJson,
	);
}

export function cloneInventory(rows: readonly InventoryRow[]) {
	return rows.map((row) => ({
		...row,
	}));
}
