import { Effect } from "effect";
import { match } from "ts-pattern";

import type { QuantitySchema } from "~/v1/quantity/schema/QuantitySchema";
import type { QuantityBoundsSchema } from "~/v1/quantity/schema/QuantityBoundsSchema";

export namespace readQuantityBoundsFx {
	export interface Props {
		quantity: QuantitySchema.Type;
	}
}

/**
 * Reads the inclusive deterministic bounds represented by one quantity contract.
 */
export const readQuantityBoundsFx = Effect.fn("readQuantityBoundsFx")(function* ({
	quantity,
}: readQuantityBoundsFx.Props) {
	return match(quantity)
		.with(
			{
				type: "value",
			},
			({ value }) => {
				return {
					min: value,
					max: value,
				} satisfies QuantityBoundsSchema.Type;
			},
		)
		.with(
			{
				type: "range",
			},
			({ min, max }) => {
				return {
					min,
					max,
				} satisfies QuantityBoundsSchema.Type;
			},
		)
		.exhaustive();
});
