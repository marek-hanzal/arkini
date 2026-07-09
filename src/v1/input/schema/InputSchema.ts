import { z } from "zod";

import { QuantitySchema } from "../../quantity/schema/QuantitySchema";
import { IdSchema } from "../../util/schema/IdSchema";
import { PositiveIntegerSchema } from "../../util/schema/PositiveIntegerSchema";

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
		/**
		 * Maximum quantity of this item that the line may store as this input.
		 */
		capacity: PositiveIntegerSchema.describe(
			"The maximum quantity of this item that the line may store as this input.",
		),
	})
	.strict()
	.describe("A canonical game item, accepted amount, and storage capacity for a gameplay input.");

export type InputSchema = typeof InputSchema;

export namespace InputSchema {
	export type Type = z.infer<InputSchema>;
}
