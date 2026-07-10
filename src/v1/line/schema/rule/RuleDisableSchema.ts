import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that disables a product line.
 *
 * When this rule applies, it takes precedence over the line's `enable` default
 * and any applicable `enable` rule. Unlike `hide`, this preserves the line in
 * the UI while preventing it from starting.
 */
export const RuleDisableSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a request to disable the line.
		 */
		type: RuleEnumSchema.extract([
			"disable",
		]).describe("Identifies this rule as a request to disable the product line."),
	})
	.strict()
	.meta({
		id: "LineRuleDisableSchema",
		description: "A rule that disables a product line when its condition is satisfied.",
	});

export type RuleDisableSchema = typeof RuleDisableSchema;

export namespace RuleDisableSchema {
	export type Type = z.infer<RuleDisableSchema>;
}
