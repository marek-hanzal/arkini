import type { ArkiniTransaction } from "~/database/server/db";
import { table } from "~/database/server/tables";
import { defaultSaveGameId } from "./save";

export async function readMutableSave(tx: ArkiniTransaction) {
  const [save, boardRows, inventoryRows] = await Promise.all([
    tx.selectFrom(table.saveGame).selectAll().where("id", "=", defaultSaveGameId).executeTakeFirstOrThrow(),
    tx.selectFrom(table.boardItem).selectAll().where("saveGameId", "=", defaultSaveGameId).execute(),
    tx.selectFrom(table.inventoryStack).selectAll().where("saveGameId", "=", defaultSaveGameId).orderBy("slotIndex").execute(),
  ]);

  return { save, boardRows, inventoryRows };
}
