import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import type { InventoryRow } from "~/inventory/logic/planning";
import { localTimestamp } from "~/play/logic/localTimestamp";

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
				updatedAt: localTimestamp(),
			})
			.where("id", "=", stack.id)
			.execute(),
	);
});
