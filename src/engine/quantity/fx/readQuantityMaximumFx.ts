import { Effect } from "effect";

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
	return quantity.max satisfies PositiveIntegerSchema.Type;
});
