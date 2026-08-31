import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** Removes non-positive entries after one complete output-reservation fold. */
export const clampOutputReservationFx = Effect.fnUntraced(function* (
	quantities: Map<IdSchema.Type, number>,
) {
	for (const [itemId, quantity] of quantities) {
		if (quantity <= 0) quantities.delete(itemId);
	}
	return quantities;
});
