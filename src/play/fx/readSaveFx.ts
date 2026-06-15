import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { defaultSaveGameId } from "~/play/logic/save";

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
