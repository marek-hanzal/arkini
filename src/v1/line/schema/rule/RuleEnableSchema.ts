import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that enables an otherwise disabled product line.
 */
export const RuleEnableSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a conditional request to enable the line.
		 */
		type: RuleEnumSchema.extract([
			"enable",
		]).describe("Identifies this rule as a request to enable the product line."),
	})
	.strict()
	.meta({
		id: "LineRuleEnableSchema",
		description: "A rule that conditionally enables a product line.",
	});

export type RuleEnableSchema = typeof RuleEnableSchema;

export namespace RuleEnableSchema {
	export type Type = z.infer<RuleEnableSchema>;
}
