import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleTypeSchema } from "./RuleTypeSchema";

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
export const RuntimeMultiplierRuleSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a product-line runtime multiplier.
		 */
		type: RuleTypeSchema.extract([
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

export type RuntimeMultiplierRuleSchema = typeof RuntimeMultiplierRuleSchema;

export namespace RuntimeMultiplierRuleSchema {
	export type Type = z.infer<RuntimeMultiplierRuleSchema>;
}
