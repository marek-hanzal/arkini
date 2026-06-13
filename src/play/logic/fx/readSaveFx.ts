import { Effect } from "effect";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import { tryGameActionFx } from "./tryGameActionFx";

export const readSaveFx = Effect.fn("readSaveFx")(function* () {
	return yield* tryGameActionFx(() =>
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
