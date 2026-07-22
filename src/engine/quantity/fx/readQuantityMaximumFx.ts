import { Effect } from "effect";
import { match } from "ts-pattern";

import { QuantityEnumSchema } from "~/engine/quantity/schema/QuantityEnumSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

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
				type: QuantityEnumSchema.enum.Value,
			},
			({ value }) => value,
		)
		.with(
			{
				type: QuantityEnumSchema.enum.Range,
			},
			({ max }) => max,
		)
		.exhaustive() satisfies PositiveIntegerSchema.Type;
});
