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
        /**
         * GPT:FIX
         * Kysely already holds types for tables, there is no need to have separate const holding table names.
         *
         * If those are not present, the code at core is broken.
         */
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

    /**
     * GPT:FIX
     *
     * Write documentation, why this is here and what it should do, same for the method itself.
     *
     * This looks quite magical; also there is a question if it's not possible to do this by the query instead of running 
     * individual queries in the loop.
     *
     * Eventually, whole thing should be wrapped in the transaction instead of pure DB bombardment.
     */
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
