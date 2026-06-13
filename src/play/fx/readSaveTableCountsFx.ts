import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";

export const readSaveTableCountsFx = Effect.fn("readSaveTableCountsFx")(function* () {
	const [
		saveGameRows,
		boardItemRows,
		inventoryStackRows,
		playerInventoryStackRows,
		playerUpgradeRows,
	] = yield* dbFx((db) =>
		Promise.all([
			db
				.selectFrom(table.saveGame)
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.executeTakeFirstOrThrow(),
			db
				.selectFrom(table.boardItem)
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.executeTakeFirstOrThrow(),
			db
				.selectFrom(table.inventoryStack)
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.executeTakeFirstOrThrow(),
			db
				.selectFrom(table.playerInventoryStack)
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.executeTakeFirstOrThrow(),
			db
				.selectFrom(table.playerUpgrade)
				.select((eb) => eb.fn.countAll<number>().as("count"))
				.executeTakeFirstOrThrow(),
		]),
	);

	return {
		saveGameCount: Number(saveGameRows.count),
		boardItemCount: Number(boardItemRows.count),
		inventoryStackCount: Number(inventoryStackRows.count),
		playerInventoryStackCount: Number(playerInventoryStackRows.count),
		playerUpgradeCount: Number(playerUpgradeRows.count),
	};
});
