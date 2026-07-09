import { z } from "zod";

import { QuantitySchema } from "../quantity/QuantitySchema";
import { IdSchema } from "../util/IdSchema";

/**
 * A canonical game item and the amount accepted by a gameplay input.
 *
 * A `quantity` with type `value` requires that exact amount. A quantity with
 * type `range`, typically from one to a maximum, replaces the legacy `upTo`
 * input mode by accepting an amount inside that inclusive range.
 */
export const InputSchema = z
	.object({
		/**
		 * ID of the canonical game item accepted by this input.
		 */
		itemId: IdSchema.describe("The ID of the canonical game item accepted by this input."),
		/**
		 * Exact or bounded amount accepted by this input.
		 *
		 * A range quantity replaces the legacy `upTo` input mode.
		 */
		quantity: QuantitySchema.describe(
			"The exact or bounded amount accepted by this input, replacing legacy upTo mode.",
		),
	})
	.strict()
	.describe("A canonical game item and the amount accepted by a gameplay input.");

export type InputSchema = typeof InputSchema;

export namespace InputSchema {
	export type Type = z.infer<InputSchema>;
}
