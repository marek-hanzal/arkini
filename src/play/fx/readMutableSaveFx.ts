import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import {
	BoardItemRowSchema,
	InventoryStackRowSchema,
	SaveRowSchema,
} from "~/play/logic/gameActionSchemas";

export const readMutableSaveFx = Effect.fn("readMutableSaveFx")(function* () {
	const [saveRow, boardRows, inventoryRows] = yield* dbFx((db) =>
		Promise.all([
			db
				.selectFrom(table.saveGame)
				.selectAll()
				.where("id", "=", defaultSaveGameId)
				.executeTakeFirstOrThrow(),
			db
				.selectFrom(table.boardItem)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
			db
				.selectFrom(table.inventoryStack)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.orderBy("slotIndex")
				.execute(),
		]),
	);

	return {
		save: SaveRowSchema.parse(saveRow),
		boardRows: boardRows.map((row) => BoardItemRowSchema.parse(row)),
		inventoryRows: inventoryRows.map((row) => InventoryStackRowSchema.parse(row)),
	};
});
