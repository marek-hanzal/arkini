import type { ItemId } from "~/manifest/server/manifestId";
import { findFreeBoardCells } from "./boardCells";
import { cloneInventory, planInventoryPlacement } from "./inventoryPlacement";
import type { BoardRow, InventoryRow, PlacementPlan, SaveShape } from "./types";

export function planPlacements(
  save: SaveShape,
  boardRows: readonly BoardRow[],
  inventoryRows: readonly InventoryRow[],
  drops: readonly ItemId[],
  origin?: { x: number; y: number },
): PlacementPlan | null {
  const freeCells = findFreeBoardCells(save, boardRows, origin);
  const virtualInventory = cloneInventory(inventoryRows);
  const plan: PlacementPlan = { board: [], inventory: [] };

  for (const itemId of drops) {
    const cell = freeCells.shift();
    if (cell) {
      plan.board.push({ itemId, ...cell });
      continue;
    }

    const inventoryPlan = planInventoryPlacement(save, virtualInventory, itemId);
    if (!inventoryPlan) return null;
    plan.inventory.push(...inventoryPlan);
  }

  return plan;
}
