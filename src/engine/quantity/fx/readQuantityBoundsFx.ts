import { Effect } from "effect";
import { match } from "ts-pattern";

import { QuantityEnumSchema } from "~/engine/quantity/schema/QuantityEnumSchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import type { QuantityBoundsSchema } from "~/engine/quantity/schema/QuantityBoundsSchema";

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
				type: QuantityEnumSchema.enum.Value,
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
				type: QuantityEnumSchema.enum.Range,
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
