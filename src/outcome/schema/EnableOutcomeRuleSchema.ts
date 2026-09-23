import { z } from "zod";

import { BaseOutcomeRuleSchema } from "./BaseOutcomeRuleSchema";
import { OutcomeRuleTypeSchema } from "./OutcomeRuleTypeSchema";

/**
 * A rule that enables a selected outcome only when all of its conditions pass.
 *
 * Every configured enable rule is a positive emission gate. A failed gate
 * discards the selected outcome without rerolling or choosing a replacement.
 */
export const EnableOutcomeRuleSchema = z
	.object({
		...BaseOutcomeRuleSchema.shape,
		/**
		 * Identifies this rule as an enable gate for the selected outcome.
		 */
		type: OutcomeRuleTypeSchema.extract([
			"Enable",
		]).describe("Identifies this rule as an enable gate for the selected outcome."),
	})
	.strict()
	.meta({
		id: "outcome.rule.EnableSchema",
		description: "A rule that enables a selected outcome when its conditions pass.",
	});

export type EnableOutcomeRuleSchema = typeof EnableOutcomeRuleSchema;

export namespace EnableOutcomeRuleSchema {
	export type Type = z.infer<EnableOutcomeRuleSchema>;
}
