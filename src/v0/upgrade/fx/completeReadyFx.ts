import { Effect } from "effect";
import { sql } from "kysely";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { defaultSaveGameId } from "~/v0/play/save";

/**
 * Promotes all finished upgrade jobs into owned upgrade levels before any read
 * projection uses them.
 *
 * Upgrade completion is based on real-world time. No timer has to be running in
 * the browser; every relevant read first folds ready jobs into the durable save.
 * A single guarded UPDATE keeps this idempotent and avoids the old read rows +
 * per-row update loop, because SQLite can do its own job without us spoon-feeding
 * it one sad row at a time.
 */
export const completeReadyFx = Effect.fn("completeReadyFx")(function* () {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	yield* dbFx((db) =>
		db
			.updateTable("playerUpgrade")
			.set({
				level: sql<number>`targetLevel`,
				targetLevel: null,
				startedAt: null,
				readyAt: null,
				updatedAt: timestamp,
			})
			.where("saveGameId", "=", defaultSaveGameId)
			.where("targetLevel", "is not", null)
			.where("readyAt", "is not", null)
			.where("readyAt", "<=", timestamp)
			.execute(),
	);
});
