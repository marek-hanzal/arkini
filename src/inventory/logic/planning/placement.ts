import type { IdService } from "~/id/context/IdServiceFx";
import { findFreeBoardCells } from "~/board/logic/planning/boardCells";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/data/manifestId";
import { cloneInventory, planInventoryPlacement } from "./inventoryPlacement";
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

export function planPlacements(
	save: SaveShape,
	boardRows: readonly BoardRow[],
	inventoryRows: readonly InventoryRow[],
	drops: readonly ItemId[],
	options: planPlacements.Options,
): PlacementPlan | null {
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
}
