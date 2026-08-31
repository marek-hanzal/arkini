import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleTypeSchema } from "./RuleTypeSchema";

/**
 * A rule that makes an otherwise hidden product line visible.
 */
export const ShowRuleSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a conditional request to show the line.
		 */
		type: RuleTypeSchema.extract([
			"Show",
		]).describe("Identifies this rule as a request to show the product line."),
	})
	.strict()
	.meta({
		id: "line.rule.ShowSchema",
		description: "A rule that conditionally makes a product line visible.",
	});

export type ShowRuleSchema = typeof ShowRuleSchema;

export namespace ShowRuleSchema {
	export type Type = z.infer<ShowRuleSchema>;
}
