import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { defaultSaveGameId } from "~/v0/play/save";

export const dropDefaultSaveFx = Effect.fn("dropDefaultSaveFx")(function* () {
	yield* dbFx((db) => db.deleteFrom("saveGame").where("id", "=", defaultSaveGameId).execute());
});
