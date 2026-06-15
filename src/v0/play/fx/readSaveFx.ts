import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { defaultSaveGameId } from "~/v0/play/save";

export const readSaveFx = Effect.fn("readSaveFx")(function* () {
	return yield* dbFx((db) =>
		db
			.selectFrom("saveGame")
			.select([
				"id",
				"boardWidth",
				"boardHeight",
				"inventorySlots",
			])
			.where("id", "=", defaultSaveGameId)
			.executeTakeFirstOrThrow(),
	);
});
