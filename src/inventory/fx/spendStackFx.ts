import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import type { InventoryRow } from "~/inventory/logic/planning/types";
import { DateServiceFx } from "~/date/context/DateServiceFx";

export namespace spendStackFx {
	export interface Props {
		stack: InventoryRow;
		quantity: number;
	}
}

export const spendStackFx = Effect.fn("spendStackFx")(function* ({
	stack,
	quantity,
}: spendStackFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const nextQuantity = stack.quantity - quantity;
	if (nextQuantity <= 0) {
		yield* dbFx((db) =>
			db.deleteFrom(table.inventoryStack).where("id", "=", stack.id).execute(),
		);
		return;
	}

	yield* dbFx((db) =>
		db
			.updateTable(table.inventoryStack)
			.set({
				quantity: nextQuantity,
				updatedAt: timestamp,
			})
			.where("id", "=", stack.id)
			.execute(),
	);
});
