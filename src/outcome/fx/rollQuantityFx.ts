import { Effect, Random } from "effect";

import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";

interface Props {
	readonly quantity: QuantitySchema.Type;
}

/**
 * Selects one integer from the configured inclusive quantity bounds.
 */
export const rollQuantityFx = Effect.fn("rollQuantityFx")(function* ({ quantity }: Props) {
	if (quantity.min === quantity.max) return quantity.min;

	return yield* Random.nextIntBetween(quantity.min, quantity.max);
});
