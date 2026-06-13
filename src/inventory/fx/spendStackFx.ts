import { Effect } from "effect";
import type { ArkiniTransaction } from "~/database/local/db";
import { table } from "~/database/local/tables";
import type { InventoryRow } from "~/inventory/logic/planning";
import { localTimestamp } from "~/play/logic/localTimestamp";
import { tryGameAction } from "~/play/logic/tryGameAction";

export namespace spendStackFx {
	export interface Props {
		tx: ArkiniTransaction;
		stack: InventoryRow;
		quantity: number;
	}
}

export const spendStackFx = Effect.fn("spendStackFx")(function* ({
	tx,
	stack,
	quantity,
}: spendStackFx.Props) {
	const nextQuantity = stack.quantity - quantity;
	if (nextQuantity <= 0) {
		yield* tryGameAction(() =>
			tx.deleteFrom(table.inventoryStack).where("id", "=", stack.id).execute(),
		);
		return;
	}

	yield* tryGameAction(() =>
		tx
			.updateTable(table.inventoryStack)
			.set({
				quantity: nextQuantity,
				updatedAt: localTimestamp(),
			})
			.where("id", "=", stack.id)
			.execute(),
	);
});
