import { Effect } from "effect";
import { completeReadyFx } from "~/upgrade/fx/completeReadyFx";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import {
	BoardItemRowSchema,
	InventoryStackRowSchema,
	PlayerUpgradeRowSchema,
	SaveRowSchema,
} from "~/play/logic/gameActionSchemas";

export const readMutableSaveFx = Effect.fn("readMutableSaveFx")(function* () {
	yield* completeReadyFx();

	const [saveRow, boardRows, inventoryRows, upgradeRows] = yield* dbFx((db) =>
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
			db
				.selectFrom(table.playerUpgrade)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
		]),
	);

	return {
		save: SaveRowSchema.parse(saveRow),
		boardRows: boardRows.map((row) => BoardItemRowSchema.parse(row)),
		inventoryRows: inventoryRows.map((row) => InventoryStackRowSchema.parse(row)),
		upgradeRows: upgradeRows.map((row) => PlayerUpgradeRowSchema.parse(row)),
	};
});
