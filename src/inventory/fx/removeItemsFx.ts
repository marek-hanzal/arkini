import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import { GameActionError } from "~/play/logic/playTypes";
import { spendStackFx } from "./spendStackFx";

export namespace removeItemsFx {
	export interface Props {
		itemId: string;
		quantity: number;
	}
}

export const removeItemsFx = Effect.fn("removeItemsFx")(function* ({
	itemId,
	quantity,
}: removeItemsFx.Props) {
	let remaining = quantity;
	const stacks = yield* dbFx((db) =>
		db
			.selectFrom(table.inventoryStack)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.where("itemDefinitionId", "=", itemId)
			.where("stateJson", "=", "{}")
			.orderBy("slotIndex")
			.execute(),
	);

	for (const stack of stacks) {
		const removed = Math.min(remaining, stack.quantity);
		yield* spendStackFx({
			stack,
			quantity: removed,
		});
		remaining -= removed;
		if (remaining === 0) return;
	}

	return yield* Effect.fail(new GameActionError("Inventory is missing required items."));
});
