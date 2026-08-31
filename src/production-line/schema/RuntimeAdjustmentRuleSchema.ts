import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleTypeSchema } from "./RuleTypeSchema";

/**
 * A rule that adjusts a product line's runtime by a signed millisecond value.
 *
 * Every applicable runtime adjustment stacks additively after the line's
 * active runtime multipliers have been applied.
 */
export const RuntimeAdjustmentRuleSchema = z
	.object({
		...BaseRuleSchema.shape,
		type: RuleTypeSchema.extract([
			"RuntimeAdjust",
		]).describe("Identifies this rule as a product-line runtime adjustment."),
		adjustMs: z
			.number()
			.int()
			.describe("The signed millisecond adjustment added to this product line's runtime."),
	})
	.strict()
	.meta({
		id: "line.rule.RuntimeAdjustmentSchema",
		description: "A rule that adjusts a product line's runtime by a signed millisecond value.",
	});

export type RuntimeAdjustmentRuleSchema = typeof RuntimeAdjustmentRuleSchema;

export namespace RuntimeAdjustmentRuleSchema {
	export type Type = z.infer<RuntimeAdjustmentRuleSchema>;
}
