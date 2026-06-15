import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { ItemInstanceRowSchema } from "~/item-instance/type/ItemInstanceRowSchema";
import { defaultSaveGameId } from "~/play/logic/save";
import { toBoardItemRow } from "../logic/toBoardItemRow";

export const readBoardItemRowsFx = Effect.fn("readBoardItemRowsFx")(function* () {
	const rows = yield* dbFx((db) =>
		db
			.selectFrom(table.itemInstance)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.where("locationKind", "=", "board")
			.orderBy("boardY")
			.orderBy("boardX")
			.execute(),
	);

	return rows.map((row) => toBoardItemRow(ItemInstanceRowSchema.parse(row)));
});
