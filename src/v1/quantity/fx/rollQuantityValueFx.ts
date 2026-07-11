import { Effect } from "effect";

import type { QuantityValueSchema } from "~/v1/quantity/schema/QuantityValueSchema";

export namespace rollQuantityValueFx {
	export interface Props {
		quantity: QuantityValueSchema.Type;
	}
}

/**
 * Resolves a fixed quantity.
 */
export const rollQuantityValueFx = Effect.fn("rollQuantityValueFx")(function* ({
	quantity,
}: rollQuantityValueFx.Props) {
	return quantity.value;
});
