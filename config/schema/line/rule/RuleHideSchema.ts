import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that hides a product line.
 *
 * When this rule applies, it takes precedence over the line's `show` default
 * and any applicable `show` rule.
 */
export const RuleHideSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a request to hide the line.
		 */
		type: RuleEnumSchema.extract(["hide"]).describe(
			"Identifies this rule as a request to hide the product line.",
		),
	})
	.strict()
	.describe("A rule that hides a product line when its condition is satisfied.");

export type RuleHideSchema = typeof RuleHideSchema;

export namespace RuleHideSchema {
	export type Type = z.infer<RuleHideSchema>;
}
