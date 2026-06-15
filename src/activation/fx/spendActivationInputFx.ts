import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import type { ItemId } from "~/manifest/manifestId";
import { GameActionError } from "~/command/GameActionError";

export namespace spendActivationInputFx {
	export interface Props {
		ownerItemInstanceId: string;
		itemId: ItemId;
		quantity: number;
	}
}

export const spendActivationInputFx = Effect.fn("spendActivationInputFx")(function* ({
	ownerItemInstanceId,
	itemId,
	quantity,
}: spendActivationInputFx.Props) {
	if (quantity <= 0) return;

	const date = yield* DateServiceFx;
	const updatedAt = date.timestamp();
	let remaining = quantity;

	const rows = yield* dbFx((db) =>
		db
			.selectFrom(table.itemInstance)
			.selectAll()
			.where("locationKind", "=", "activation-input")
			.where("ownerItemInstanceId", "=", ownerItemInstanceId)
			.where("itemDefinitionId", "=", itemId)
			.orderBy("createdAt")
			.execute(),
	);

	const available = rows.reduce((sum, row) => sum + row.quantity, 0);
	if (available < quantity) {
		return yield* Effect.fail(new GameActionError("Stored activation input is missing."));
	}

	for (const row of rows) {
		const spent = Math.min(row.quantity, remaining);
		const nextQuantity = row.quantity - spent;
		remaining -= spent;

		if (nextQuantity <= 0) {
			yield* dbFx((db) =>
				db.deleteFrom(table.itemInstance).where("id", "=", row.id).execute(),
			);
		} else {
			yield* dbFx((db) =>
				db
					.updateTable(table.itemInstance)
					.set({
						quantity: nextQuantity,
						updatedAt,
					})
					.where("id", "=", row.id)
					.execute(),
			);
		}

		if (remaining <= 0) return;
	}
});
