import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";

export const dropDefaultSaveFx = Effect.fn("dropDefaultSaveFx")(function* () {
	yield* dbFx((db) =>
		db.deleteFrom(table.saveGame).where("id", "=", defaultSaveGameId).execute(),
	);
});
