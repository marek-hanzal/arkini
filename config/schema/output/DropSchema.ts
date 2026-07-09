import { z } from "zod";

import { QuantitySchema } from "../quantity/QuantitySchema";
import { IdSchema } from "../util/IdSchema";

/**
 * A quantity of a canonical game item emitted by a successful roll.
 *
 * Drops reference the item catalog by ID instead of embedding a duplicate item
 * definition, which keeps item behavior and cross-reference validation central.
 */
export const DropSchema = z
	.object({
		/**
		 * ID of the canonical game item emitted by this drop.
		 */
		itemId: IdSchema.describe("The ID of the canonical game item emitted by this drop."),
		/**
		 * Number of this item emitted by the drop.
		 */
		quantity: QuantitySchema.describe("The quantity emitted by this drop."),
	})
	.strict()
	.describe("A canonical game item and the quantity emitted by a successful roll.");

export type DropSchema = typeof DropSchema;

export namespace DropSchema {
	export type Type = z.infer<DropSchema>;
}
