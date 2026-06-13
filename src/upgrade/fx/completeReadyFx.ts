import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { defaultSaveGameId } from "~/play/logic/save";

export const completeReadyFx = Effect.fn("completeReadyFx")(function* () {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const readyRows = yield* dbFx((db) =>
		db
			.selectFrom(table.playerUpgrade)
			.select([
				"id",
				"targetLevel",
			])
			.where("saveGameId", "=", defaultSaveGameId)
			.where("targetLevel", "is not", null)
			.where("readyAt", "is not", null)
			.where("readyAt", "<=", timestamp)
			.execute(),
	);

	for (const row of readyRows) {
		const targetLevel = row.targetLevel;
		if (targetLevel === null) continue;
		yield* dbFx((db) =>
			db
				.updateTable(table.playerUpgrade)
				.set({
					level: targetLevel,
					targetLevel: null,
					startedAt: null,
					readyAt: null,
					updatedAt: timestamp,
				})
				.where("id", "=", row.id)
				.execute(),
		);
	}
});
