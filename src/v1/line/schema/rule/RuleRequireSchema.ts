import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that requires a condition before a visible product line can start.
 *
 * A failed requirement keeps the line visible but unavailable. This differs
 * from `block`, whose condition actively prevents the line from starting.
 */
export const RuleRequireSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a requirement for starting the line.
		 */
		type: RuleEnumSchema.extract([
			"require",
		]).describe("Identifies this rule as a requirement for starting the product line."),
	})
	.strict()
	.meta({
		id: "LineRuleRequireSchema",
		description: "A rule that requires a condition before a product line can start.",
	});

export type RuleRequireSchema = typeof RuleRequireSchema;

export namespace RuleRequireSchema {
	export type Type = z.infer<RuleRequireSchema>;
}
