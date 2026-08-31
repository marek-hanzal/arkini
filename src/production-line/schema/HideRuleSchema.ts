import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleTypeSchema } from "./RuleTypeSchema";

/**
 * A rule that hides a product line.
 *
 * When this rule applies, it takes precedence over the line's `show` default
 * and any applicable `show` rule.
 */
export const HideRuleSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a request to hide the line.
		 */
		type: RuleTypeSchema.extract([
			"Hide",
		]).describe("Identifies this rule as a request to hide the product line."),
	})
	.strict()
	.meta({
		id: "line.rule.HideSchema",
		description: "A rule that hides a product line when its condition is satisfied.",
	});

export type HideRuleSchema = typeof HideRuleSchema;

export namespace HideRuleSchema {
	export type Type = z.infer<HideRuleSchema>;
}
