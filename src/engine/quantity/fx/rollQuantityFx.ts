import { Effect, Random } from "effect";

import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

export namespace rollQuantityFx {
	export interface Props {
		quantity: QuantitySchema.Type;
	}
}

/**
 * Selects one integer from the configured inclusive quantity bounds.
 */
export const rollQuantityFx = Effect.fn("rollQuantityFx")(function* ({
	quantity,
}: rollQuantityFx.Props) {
	if (quantity.min === quantity.max) return quantity.min;

	return yield* Random.nextIntBetween(quantity.min, quantity.max);
});
