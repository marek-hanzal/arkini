import { Effect } from "effect";
import { completeReadyFx } from "~/upgrade/fx/completeReadyFx";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";

export const readLevelsFx = Effect.fn("readLevelsFx")(function* () {
	yield* completeReadyFx();

	return yield* dbFx((db) =>
		db
			.selectFrom(table.playerUpgrade)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.execute(),
	);
});
