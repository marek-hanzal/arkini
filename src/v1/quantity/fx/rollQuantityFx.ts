import { Effect } from "effect";
import { match } from "ts-pattern";

import type { QuantitySchema } from "~/v1/quantity/schema/QuantitySchema";
import { rollQuantityRangeFx } from "./rollQuantityRangeFx";
import { rollQuantityValueFx } from "./rollQuantityValueFx";

export namespace rollQuantityFx {
	export interface Props {
		quantity: QuantitySchema.Type;
	}
}

/** Dispatches a quantity configuration to its specialized resolver. */
export const rollQuantityFx = Effect.fn("rollQuantityFx")(function* ({
	quantity,
}: rollQuantityFx.Props) {
	return yield* match(quantity)
		.with(
			{
				type: "value",
			},
			(quantity) =>
				rollQuantityValueFx({
					quantity,
				}),
		)
		.with(
			{
				type: "range",
			},
			(quantity) =>
				rollQuantityRangeFx({
					quantity,
				}),
		)
		.exhaustive();
});
