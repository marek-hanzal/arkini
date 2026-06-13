import { Effect } from "effect";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import { tryGameAction } from "../logic/tryGameAction";

export const readSaveFx = Effect.fn("readSaveFx")(function* () {
	return yield* tryGameAction(() =>
		db
			.selectFrom(table.saveGame)
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
