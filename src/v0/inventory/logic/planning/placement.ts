import type { IdService } from "~/v0/id/context/IdServiceFx";
import { findFreeBoardCells } from "~/v0/board/logic/planning/findFreeBoardCells";
import type { GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { cloneInventory } from "./cloneInventory";
import { planInventoryPlacement } from "./planInventoryPlacement";
import type { BoardRow, InventoryRow, PlacementPlan, SaveShape } from "./types";

export namespace planPlacements {
	export interface Options {
		gameConfig: GameConfigService;
		id: IdService;
		origin?: {
			x: number;
			y: number;
		};
	}
}

export const planPlacements = (
	save: SaveShape,
	boardRows: readonly BoardRow[],
	inventoryRows: readonly InventoryRow[],
	drops: readonly ItemId[],
	options: planPlacements.Options,
): PlacementPlan | null => {
	const freeCells = findFreeBoardCells(save, boardRows, options.origin);
	const virtualInventory = cloneInventory(inventoryRows);
	const plan: PlacementPlan = {
		board: [],
		inventory: [],
	};

	for (const itemId of drops) {
		const cell = freeCells.shift();
		if (cell) {
			plan.board.push({
				itemId,
				...cell,
			});
			continue;
		}

		const inventoryPlan = planInventoryPlacement(save, virtualInventory, itemId, options);
		if (!inventoryPlan) return null;
		plan.inventory.push(...inventoryPlan);
	}

	return plan;
};
