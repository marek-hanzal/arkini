import type { ArkiniTransaction } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { BoardItemRowSchema, InventoryStackRowSchema, SaveRowSchema } from "./gameActionSchemas";
import { defaultSaveGameId } from "./save";

export async function readMutableSave(tx: ArkiniTransaction) {
	const [saveRow, boardRows, inventoryRows] = await Promise.all([
		tx
			.selectFrom(table.saveGame)
			.selectAll()
			.where("id", "=", defaultSaveGameId)
			.executeTakeFirstOrThrow(),
		tx
			.selectFrom(table.boardItem)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.execute(),
		tx
			.selectFrom(table.inventoryStack)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.orderBy("slotIndex")
			.execute(),
	]);

	return {
		save: SaveRowSchema.parse(saveRow),
		boardRows: boardRows.map((row) => BoardItemRowSchema.parse(row)),
		inventoryRows: inventoryRows.map((row) => InventoryStackRowSchema.parse(row)),
	};
}
