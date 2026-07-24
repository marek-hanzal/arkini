import { Effect } from "effect";
import { match } from "ts-pattern";

import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

/** Projects one authored quantity into the exact bounds shown by Item Detail. */
export const readItemDetailQuantityBoundsFx = Effect.fn("readItemDetailQuantityBoundsFx")(
	function* (quantity: QuantitySchema.Type) {
		return match(quantity)
			.with(
				{
					type: "value",
				},
				({ value }) => ({
					min: value,
					max: value,
				}),
			)
			.with(
				{
					type: "range",
				},
				({ min, max }) => ({
					min,
					max,
				}),
			)
			.exhaustive() satisfies ItemDetailLines.QuantityBounds;
	},
);
