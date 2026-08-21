import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** Applies one exact quantity delta while keeping zero entries out of the net-output map. */
export const adjustLineNetMaximumOutputQuantityFx = Effect.fnUntraced(function* (
	quantities: Map<IdSchema.Type, number>,
	itemId: IdSchema.Type,
	delta: number,
) {
	const quantity = (quantities.get(itemId) ?? 0) + delta;
	if (quantity === 0) quantities.delete(itemId);
	else quantities.set(itemId, quantity);
});
