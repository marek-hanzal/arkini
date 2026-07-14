import { Effect } from "effect";
import { match } from "ts-pattern";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { QuantitySchema } from "~/v1/quantity/schema/QuantitySchema";

export namespace readQuantityMaximumFx {
	export interface Props {
		quantity: QuantitySchema.Type;
	}
}

/** Reads the largest concrete quantity one authored quantity contract may resolve to. */
export const readQuantityMaximumFx = Effect.fn("readQuantityMaximumFx")(function* ({
	quantity,
}: readQuantityMaximumFx.Props) {
	return match(quantity)
		.with(
			{
				type: "value",
			},
			({ value }) => value,
		)
		.with(
			{
				type: "range",
			},
			({ max }) => max,
		)
		.exhaustive() satisfies PositiveIntegerSchema.Type;
});
