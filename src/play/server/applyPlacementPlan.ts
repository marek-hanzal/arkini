import { defaultSaveGameId } from "./save";
import { insertBoardItem } from "~/board/server/boardItemStore";
import { serverTimestamp } from "./serverTimestamp";
import { table } from "~/database/server/tables";
import type { ArkiniTransaction } from "~/database/server/db";
import type { InventoryPlacementPlan, PlacementPlan } from "~/inventory/server/planning";
import type { ProducerPlacement } from "./playTypes";

export async function applyPlacementPlan(tx: ArkiniTransaction, plan: PlacementPlan): Promise<ProducerPlacement[]> {
  const placements: ProducerPlacement[] = [];

  for (const placement of plan.board) {
    const boardItemId = await insertBoardItem(tx, placement.itemId, placement.x, placement.y);
    placements.push({ kind: "board", itemId: placement.itemId, boardItemId, x: placement.x, y: placement.y });
  }

  for (const placement of plan.inventory) {
    if (placement.type === "update") {
      await tx.updateTable(table.inventoryStack).set({ quantity: placement.quantity, updatedAt: serverTimestamp() }).where("id", "=", placement.stackId).execute();
    } else {
      await tx
        .insertInto(table.inventoryStack)
        .values({
          id: placement.stackId,
          saveGameId: defaultSaveGameId,
          slotIndex: placement.slotIndex,
          itemDefinitionId: placement.itemId,
          quantity: placement.quantity,
        })
        .execute();
    }
    placements.push({ kind: "inventory", itemId: placement.itemId, slotIndex: placement.slotIndex });
  }

  return placements;
}

export async function applyInventoryPlacementPlan(tx: ArkiniTransaction, plan: readonly InventoryPlacementPlan[]) {
  await applyPlacementPlan(tx, { board: [], inventory: [...plan] });
}
