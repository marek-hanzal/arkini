import { z } from "zod";

import { BaseDropRuleSchema } from "./BaseDropRuleSchema";
import { DropRuleTypeSchema } from "./DropRuleTypeSchema";

/**
 * A rule that disables a selected drop when all of its conditions pass.
 *
 * An applicable disable rule vetoes emission. The selected drop is discarded
 * without rerolling or choosing a replacement candidate.
 */
export const DisableDropRuleSchema = z
	.object({
		...BaseDropRuleSchema.shape,
		/**
		 * Identifies this rule as a disable veto for the selected drop.
		 */
		type: DropRuleTypeSchema.extract([
			"Disable",
		]).describe("Identifies this rule as a disable veto for the selected drop."),
	})
	.strict()
	.meta({
		id: "drop.rule.DisableSchema",
		description: "A rule that disables a selected drop when its conditions pass.",
	});

export type DisableDropRuleSchema = typeof DisableDropRuleSchema;

export namespace DisableDropRuleSchema {
	export type Type = z.infer<DisableDropRuleSchema>;
}
