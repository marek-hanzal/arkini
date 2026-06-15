import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { readBoardItemRowsFx } from "~/v0/item-instance/fx/readBoardItemRowsFx";
import { readInventoryStackRowsFx } from "~/v0/item-instance/fx/readInventoryStackRowsFx";
import { defaultSaveGameId } from "~/v0/play/save";
import { PlayerUpgradeRowSchema } from "~/v0/play/schema/PlayerUpgradeRowSchema";
import { SaveRowSchema } from "~/v0/play/schema/SaveRowSchema";
import { completeReadyFx } from "~/v0/upgrade/fx/completeReadyFx";

export const readMutableSaveFx = Effect.fn("readMutableSaveFx")(function* () {
	yield* completeReadyFx();

	const [saveRow, boardRows, inventoryRows, upgradeRows] = yield* Effect.all([
		dbFx((db) =>
			db
				.selectFrom("saveGame")
				.selectAll()
				.where("id", "=", defaultSaveGameId)
				.executeTakeFirstOrThrow(),
		),
		readBoardItemRowsFx(),
		readInventoryStackRowsFx(),
		dbFx((db) =>
			db
				.selectFrom("playerUpgrade")
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
