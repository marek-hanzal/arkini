import { z } from "zod";

import { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";

/**
 * Inclusive positive bounds resolved by one input, output, or weighted roll.
 */
export const QuantitySchema = z
	.object({
		min: PositiveIntegerSchema.describe("The smallest quantity that may resolve."),
		max: PositiveIntegerSchema.describe("The largest quantity that may resolve."),
	})
	.strict()
	.refine((quantity) => quantity.max >= quantity.min, {
		message: "max must be greater than or equal to min",
	})
	.meta({
		id: "QuantitySchema",
		description: "The inclusive positive bounds resolved by one quantity contract.",
	});

export type QuantitySchema = typeof QuantitySchema;

export namespace QuantitySchema {
	export type Type = z.infer<QuantitySchema>;
}
