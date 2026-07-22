import { Effect } from "effect";
import { match } from "ts-pattern";

import { QuantityEnumSchema } from "~/engine/quantity/schema/QuantityEnumSchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

import { rollQuantityRangeFx } from "./rollQuantityRangeFx";
import { rollQuantityValueFx } from "./rollQuantityValueFx";

export namespace rollQuantityFx {
	export interface Props {
		quantity: QuantitySchema.Type;
	}
}

/**
 * Dispatches a quantity configuration to its specialized resolver.
 */
export const rollQuantityFx = Effect.fn("rollQuantityFx")(function* ({
	quantity,
}: rollQuantityFx.Props) {
	return yield* match(quantity)
		.with(
			{
				type: QuantityEnumSchema.enum.Value,
			},
			(quantity) => {
				return rollQuantityValueFx({
					quantity,
				});
			},
		)
		.with(
			{
				type: QuantityEnumSchema.enum.Range,
			},
			(quantity) => {
				return rollQuantityRangeFx({
					quantity,
				});
			},
		)
		.exhaustive();
});
