import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";

export const readSaveFx = Effect.fn("readSaveFx")(function* () {
	return yield* dbFx((db) =>
		db
			.selectFrom(table.saveGame)
			.select([
				"id",
				"boardWidth",
				"boardHeight",
				"inventorySlots",
				"playerInventorySlots",
			])
			.where("id", "=", defaultSaveGameId)
			.executeTakeFirstOrThrow(),
	);
});
