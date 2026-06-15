import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { ItemInstanceRowSchema } from "~/v0/item-instance/type/ItemInstanceRowSchema";
import { defaultSaveGameId } from "~/v0/play/save";
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
