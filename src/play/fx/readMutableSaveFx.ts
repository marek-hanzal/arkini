import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { readBoardItemRowsFx } from "~/item-instance/fx/readBoardItemRowsFx";
import { readInventoryStackRowsFx } from "~/item-instance/fx/readInventoryStackRowsFx";
import { defaultSaveGameId } from "~/play/logic/save";
import { PlayerUpgradeRowSchema } from "~/play/schema/PlayerUpgradeRowSchema";
import { SaveRowSchema } from "~/play/schema/SaveRowSchema";
import { completeReadyFx } from "~/upgrade/fx/completeReadyFx";

export const readMutableSaveFx = Effect.fn("readMutableSaveFx")(function* () {
	yield* completeReadyFx();

	const [saveRow, boardRows, inventoryRows, upgradeRows] = yield* Effect.all([
		dbFx((db) =>
			db
				.selectFrom(table.saveGame)
				.selectAll()
				.where("id", "=", defaultSaveGameId)
				.executeTakeFirstOrThrow(),
		),
		readBoardItemRowsFx(),
		readInventoryStackRowsFx(),
		dbFx((db) =>
			db
				.selectFrom(table.playerUpgrade)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
		),
	]);

	return {
		save: SaveRowSchema.parse(saveRow),
		boardRows,
		inventoryRows,
		upgradeRows: upgradeRows.map((row) => PlayerUpgradeRowSchema.parse(row)),
	};
});
