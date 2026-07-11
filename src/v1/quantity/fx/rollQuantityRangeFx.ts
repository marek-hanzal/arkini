import { Effect, Random } from "effect";

import type { QuantityRangeSchema } from "~/v1/quantity/schema/QuantityRangeSchema";

export namespace rollQuantityRangeFx {
	export interface Props {
		quantity: QuantityRangeSchema.Type;
	}
}

/**
 * Selects one integer from an inclusive configured quantity range.
 */
export const rollQuantityRangeFx = Effect.fn("rollQuantityRangeFx")(function* ({
	quantity,
}: rollQuantityRangeFx.Props) {
	return yield* Random.nextIntBetween(quantity.min, quantity.max + 1);
});
