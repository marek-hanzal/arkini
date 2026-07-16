import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/**
 * Inclusive minimum and maximum represented by one quantity contract.
 */
export const QuantityBoundsSchema = z
	.object({
		/**
		 * Smallest quantity accepted by the contract.
		 */
		min: PositiveIntegerSchema.describe("The smallest accepted positive quantity."),
		/**
		 * Largest quantity accepted by the contract.
		 */
		max: PositiveIntegerSchema.describe("The largest accepted positive quantity."),
	})
	.strict()
	.refine((bounds) => bounds.max >= bounds.min, {
		message: "max must be greater than or equal to min",
	})
	.meta({
		id: "QuantityBoundsSchema",
		description: "The inclusive positive bounds represented by one quantity contract.",
	});

export type QuantityBoundsSchema = typeof QuantityBoundsSchema;

export namespace QuantityBoundsSchema {
	export type Type = z.infer<QuantityBoundsSchema>;
}
