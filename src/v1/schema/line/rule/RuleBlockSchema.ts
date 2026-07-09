import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that prevents a visible product line from starting.
 *
 * Unlike `hide`, this preserves the line in the UI so that its blocked state
 * and the reason for it can be presented to the player.
 */
export const RuleBlockSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a request to block the line from starting.
		 */
		type: RuleEnumSchema.extract([
			"block",
		]).describe("Identifies this rule as a request to block the product line from starting."),
	})
	.strict()
	.describe("A rule that prevents a visible product line from starting.");

export type RuleBlockSchema = typeof RuleBlockSchema;

export namespace RuleBlockSchema {
	export type Type = z.infer<RuleBlockSchema>;
}
