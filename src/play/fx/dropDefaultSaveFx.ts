import { Effect } from "effect";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import { tryGameAction } from "../logic/tryGameAction";

export const dropDefaultSaveFx = Effect.fn("dropDefaultSaveFx")(function* () {
	yield* tryGameAction(() =>
		db.deleteFrom(table.saveGame).where("id", "=", defaultSaveGameId).execute(),
	);
});
