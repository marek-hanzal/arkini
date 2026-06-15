import type { IdService } from "~/v0/id/context/IdServiceFx";
import { emptyInventoryStateJson } from "~/v0/inventory/logic/emptyInventoryStateJson";
import { isEmptyInventoryStateJson } from "~/v0/inventory/logic/isEmptyInventoryStateJson";
import type { GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { assertInsideInventory } from "./inventoryBounds";
import { planEmptySlotPlacement } from "./inventorySlot";
import { planStackPlacement } from "./inventoryStack";
import type { InventoryPlacementPlan, InventoryRow, SaveShape } from "./types";

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
