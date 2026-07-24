import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailQuantityBoundsFx } from "~/engine/item-detail/read/readItemDetailQuantityBoundsFx";
import type { DropSchema } from "~/engine/output/schema/DropSchema";

/** Aggregates duplicate drops inside one exact output-roll branch. */
export const readItemDetailOutputItemsFx = Effect.fn("readItemDetailOutputItemsFx")(function* (
	drops: readonly DropSchema.Type[],
) {
	const grouped = new Map<IdSchema.Type, ItemDetailLines.OutputItem>();
	for (const drop of drops) {
		const bounds = yield* readItemDetailQuantityBoundsFx(drop.quantity);
		const previous = grouped.get(drop.itemId);
		grouped.set(drop.itemId, {
			itemId: drop.itemId,
			quantity: {
				min: (previous?.quantity.min ?? 0) + bounds.min,
				max: (previous?.quantity.max ?? 0) + bounds.max,
			},
		});
	}
	return [
		...grouped.values(),
	];
});
