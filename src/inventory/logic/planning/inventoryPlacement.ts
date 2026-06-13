import type { IdService } from "~/id/context/IdServiceFx";
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
	}
}

export function planInventoryPlacement(
	save: SaveShape,
	inventory: InventoryRow[],
	itemId: ItemId | string,
	options: planInventoryPlacement.Options,
): InventoryPlacementPlan[] | null {
	const stackPlan = planStackPlacement(inventory, itemId, options.gameConfig);
	if (stackPlan) return stackPlan;

	for (let slotIndex = 0; slotIndex < save.inventorySlots; slotIndex += 1) {
		const insertPlan = planEmptySlotPlacement(save, inventory, itemId, slotIndex, options.id);
		if (insertPlan) return insertPlan;
	}

	return null;
}

export namespace planExactInventorySlotPlacement {
	export interface Options {
		gameConfig: GameConfigService;
		id: IdService;
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

	const target = inventory.find((stack) => stack.slotIndex === slotIndex);
	if (!target) return planEmptySlotPlacement(save, inventory, itemId, slotIndex, options.id);
	if (target.itemDefinitionId !== itemId) return null;

	return planStackPlacement(
		[
			target,
		],
		itemId,
		options.gameConfig,
	);
}

export function cloneInventory(rows: readonly InventoryRow[]) {
	return rows.map((row) => ({
		...row,
	}));
}
