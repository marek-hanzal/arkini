import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that disables a selected drop when all of its conditions pass.
 *
 * An applicable disable rule vetoes emission. The selected drop is discarded
 * without rerolling or choosing a replacement candidate.
 */
export const RuleDisableSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as a disable veto for the selected drop.
		 */
		type: RuleEnumSchema.extract([
			RuleEnumSchema.enum.Disable,
		]).describe("Identifies this rule as a disable veto for the selected drop."),
	})
	.strict()
	.meta({
		id: "DropRuleDisableSchema",
		description: "A rule that disables a selected drop when its conditions pass.",
	});

export type RuleDisableSchema = typeof RuleDisableSchema;

export namespace RuleDisableSchema {
	export type Type = z.infer<RuleDisableSchema>;
}
