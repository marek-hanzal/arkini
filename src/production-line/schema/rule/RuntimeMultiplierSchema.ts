import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

const PositiveNumberSchema = z.number().positive().meta({
	id: "PositiveNumberSchema",
	description: "A number greater than zero.",
});

/**
 * A rule that multiplies a product line's runtime when its conditions pass.
 *
 * Every applicable runtime multiplier stacks multiplicatively with the line's
 * base runtime and other applicable runtime multiplier rules.
 */
export const RuntimeMultiplierSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this rule as a product-line runtime multiplier.
		 */
		type: TypeSchema.extract([
			"RuntimeMultiplier",
		]).describe("Identifies this rule as a product-line runtime multiplier."),
		/**
		 * Positive factor multiplied into this line's runtime.
		 */
		multiplier: PositiveNumberSchema.describe(
			"The positive factor multiplied into this product line's runtime.",
		),
	})
	.strict()
	.meta({
		id: "line.rule.RuntimeMultiplierSchema",
		description: "A rule that multiplies a product line's runtime when its conditions pass.",
	});

export type RuntimeMultiplierSchema = typeof RuntimeMultiplierSchema;

export namespace RuntimeMultiplierSchema {
	export type Type = z.infer<RuntimeMultiplierSchema>;
}
