import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that disables a product line.
 *
 * An applicable disable rule vetoes the line's availability, taking precedence
 * over its `enable` default and every enable gate. Unlike `hide`, this preserves
 * the line in the UI while preventing it from starting.
 */
export const RuleDisableSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a disable veto for the line.
		 */
		type: RuleEnumSchema.extract([
			RuleEnumSchema.enum.Disable,
		]).describe("Identifies this rule as a disable veto for the product line."),
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
