import { Effect } from "effect";

import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

/** Projects one authored quantity into the exact bounds shown by Item Detail. */
export const readItemDetailQuantityBoundsFx = Effect.fn("readItemDetailQuantityBoundsFx")(
	function* (quantity: QuantitySchema.Type) {
		return quantity satisfies ItemDetailLines.QuantityBounds;
	},
);
