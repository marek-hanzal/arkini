import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { ItemInstanceRowSchema } from "~/v0/item-instance/type/ItemInstanceRowSchema";
import { defaultSaveGameId } from "~/v0/play/save";
import { toBoardItemRow } from "../logic/toBoardItemRow";

export const readBoardItemRowsFx = Effect.fn("readBoardItemRowsFx")(function* () {
	const rows = yield* dbFx((db) =>
		db
			.selectFrom("itemInstance")
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.where("locationKind", "=", "board")
			.orderBy("boardY")
			.orderBy("boardX")
			.execute(),
	);

	return rows.map((row) => toBoardItemRow(ItemInstanceRowSchema.parse(row)));
});
