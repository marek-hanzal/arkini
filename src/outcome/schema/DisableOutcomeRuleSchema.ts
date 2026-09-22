import { z } from "zod";

import { BaseOutcomeRuleSchema } from "./BaseOutcomeRuleSchema";
import { OutcomeRuleTypeSchema } from "./OutcomeRuleTypeSchema";

/**
 * A rule that disables a selected outcome when all of its conditions pass.
 *
 * An applicable disable rule vetoes emission. The selected outcome is discarded
 * without rerolling or choosing a replacement candidate.
 */
export const DisableOutcomeRuleSchema = z
	.object({
		...BaseOutcomeRuleSchema.shape,
		/**
		 * Identifies this rule as a disable veto for the selected outcome.
		 */
		type: OutcomeRuleTypeSchema.extract([
			"Disable",
		]).describe("Identifies this rule as a disable veto for the selected outcome."),
	})
	.strict()
	.meta({
		id: "outcome.rule.DisableSchema",
		description: "A rule that disables a selected outcome when its conditions pass.",
	});

export type DisableOutcomeRuleSchema = typeof DisableOutcomeRuleSchema;

export namespace DisableOutcomeRuleSchema {
	export type Type = z.infer<DisableOutcomeRuleSchema>;
}
