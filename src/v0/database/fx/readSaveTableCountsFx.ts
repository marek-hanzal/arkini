import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";

export const readSaveTableCountsFx = Effect.fn("readSaveTableCountsFx")(function* () {
	const [saveGameRows, boardItemRows, inventoryStackRows, playerUpgradeRows] = yield* dbFx((db) =>
		Promise.all([
			db
				.selectFrom("saveGame")
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.executeTakeFirstOrThrow(),
			db
				.selectFrom("itemInstance")
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.where("locationKind", "=", "board")
				.executeTakeFirstOrThrow(),
			db
				.selectFrom("itemInstance")
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.where("locationKind", "=", "inventory")
				.executeTakeFirstOrThrow(),
			db
				.selectFrom("playerUpgrade")
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.executeTakeFirstOrThrow(),
		]),
	);

	return {
		saveGameCount: Number(saveGameRows.count),
		boardItemCount: Number(boardItemRows.count),
		inventoryStackCount: Number(inventoryStackRows.count),
		playerUpgradeCount: Number(playerUpgradeRows.count),
	};
});
