import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that adjusts a product line's runtime by a signed millisecond value.
 *
 * Every applicable runtime adjustment stacks additively after the line's
 * active runtime multipliers have been applied.
 */
export const RuleRuntimeAdjustSchema = z
	.object({
		...BaseRuleSchema.shape,
		type: RuleEnumSchema.extract([
			"RuntimeAdjust",
		]).describe("Identifies this rule as a product-line runtime adjustment."),
		adjustMs: z
			.number()
			.int()
			.describe("The signed millisecond adjustment added to this product line's runtime."),
	})
	.strict()
	.meta({
		id: "RuleRuntimeAdjustSchema",
		description: "A rule that adjusts a product line's runtime by a signed millisecond value.",
	});

export type RuleRuntimeAdjustSchema = typeof RuleRuntimeAdjustSchema;

export namespace RuleRuntimeAdjustSchema {
	export type Type = z.infer<RuleRuntimeAdjustSchema>;
}
