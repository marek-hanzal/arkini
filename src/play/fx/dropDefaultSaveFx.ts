import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { defaultSaveGameId } from "~/play/logic/save";

export const dropDefaultSaveFx = Effect.fn("dropDefaultSaveFx")(function* () {
	yield* dbFx((db) =>
		db.deleteFrom("saveGame").where("id", "=", defaultSaveGameId).execute(),
	);
});
