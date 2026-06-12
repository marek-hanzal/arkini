import { GameActionError } from "./gameplayTypes";
import { defaultSaveGameId } from "./save";
import { serverTimestamp } from "./serverTimestamp";
import { table } from "~/database/server/tables";
import type { ArkiniTransaction } from "~/database/server/db";
import type { InventoryRow } from "./planning";

export async function spendInventoryStack(tx: ArkiniTransaction, stack: InventoryRow, quantity: number) {
  const nextQuantity = stack.quantity - quantity;
  if (nextQuantity <= 0) {
    await tx.deleteFrom(table.inventoryStack).where("id", "=", stack.id).execute();
    return;
  }

  await tx.updateTable(table.inventoryStack).set({ quantity: nextQuantity, updatedAt: serverTimestamp() }).where("id", "=", stack.id).execute();
}

export async function removeInventoryItems(tx: ArkiniTransaction, itemId: string, quantity: number) {
  let remaining = quantity;
  const stacks = await tx
    .selectFrom(table.inventoryStack)
    .selectAll()
    .where("saveGameId", "=", defaultSaveGameId)
    .where("itemDefinitionId", "=", itemId)
    .orderBy("slotIndex")
    .execute();

  for (const stack of stacks) {
    const removed = Math.min(remaining, stack.quantity);
    await spendInventoryStack(tx, stack, removed);
    remaining -= removed;
    if (remaining === 0) return;
  }

  throw new GameActionError("Inventory is missing required items.");
}
