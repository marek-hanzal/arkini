import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import type { InventoryRow } from "~/v0/inventory/model/InventoryRow";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";

export namespace spendInventoryStackFx {
	export interface Props {
		stack: InventoryRow;
		quantity: number;
	}
}

export const spendInventoryStackFx = Effect.fn("spendInventoryStackFx")(function* ({
	stack,
	quantity,
}: spendInventoryStackFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const nextQuantity = stack.quantity - quantity;
	if (nextQuantity <= 0) {
		yield* dbFx((db) => db.deleteFrom("itemInstance").where("id", "=", stack.id).execute());
		return;
	}

	yield* dbFx((db) =>
		db
			.updateTable("itemInstance")
			.set({
				quantity: nextQuantity,
				updatedAt: timestamp,
			})
			.where("id", "=", stack.id)
			.execute(),
	);
});
