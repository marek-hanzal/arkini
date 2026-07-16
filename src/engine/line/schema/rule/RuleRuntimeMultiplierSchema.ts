import { z } from "zod";

import { PositiveNumberSchema } from "~/engine/common/schema/PositiveNumberSchema";
import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that multiplies a product line's runtime when its conditions pass.
 *
 * Every applicable runtime multiplier stacks multiplicatively with the line's
 * base runtime and other applicable runtime multiplier rules.
 */
export const RuleRuntimeMultiplierSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a product-line runtime multiplier.
		 */
		type: RuleEnumSchema.extract([
			"runtime:multiplier",
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
		id: "RuleRuntimeMultiplierSchema",
		description: "A rule that multiplies a product line's runtime when its conditions pass.",
	});

export type RuleRuntimeMultiplierSchema = typeof RuleRuntimeMultiplierSchema;

export namespace RuleRuntimeMultiplierSchema {
	export type Type = z.infer<RuleRuntimeMultiplierSchema>;
}
