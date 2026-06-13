import { Effect } from "effect";
import type { ArkiniTransaction } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import { GameActionError } from "~/play/logic/playTypes";
import { tryGameActionFx } from "~/play/logic/fx/tryGameActionFx";
import { spendStackFx } from "./spendStackFx";

export namespace removeItemsFx {
	export interface Props {
		tx: ArkiniTransaction;
		itemId: string;
		quantity: number;
	}
}

export const removeItemsFx = Effect.fn("removeItemsFx")(function* ({
	tx,
	itemId,
	quantity,
}: removeItemsFx.Props) {
	let remaining = quantity;
	const stacks = yield* tryGameActionFx(() =>
		tx
			.selectFrom(table.inventoryStack)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.where("itemDefinitionId", "=", itemId)
			.orderBy("slotIndex")
			.execute(),
	);

	for (const stack of stacks) {
		const removed = Math.min(remaining, stack.quantity);
		yield* spendStackFx({
			tx,
			stack,
			quantity: removed,
		});
		remaining -= removed;
		if (remaining === 0) return;
	}

	return yield* Effect.fail(new GameActionError("Inventory is missing required items."));
});
