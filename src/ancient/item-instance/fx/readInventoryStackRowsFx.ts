import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { ItemInstanceRowSchema } from "~/item-instance/type/ItemInstanceRowSchema";
import { defaultSaveGameId } from "~/play/logic/save";
import { toInventoryStackRow } from "../logic/toInventoryStackRow";

export const readInventoryStackRowsFx = Effect.fn("readInventoryStackRowsFx")(function* () {
	const rows = yield* dbFx((db) =>
		db
			.selectFrom("itemInstance")
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.where("locationKind", "=", "inventory")
			.orderBy("inventorySlotIndex")
			.execute(),
	);

	return rows.map((row) => toInventoryStackRow(ItemInstanceRowSchema.parse(row)));
});
