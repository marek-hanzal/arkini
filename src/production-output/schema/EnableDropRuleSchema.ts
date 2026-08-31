import { z } from "zod";

import { BaseDropRuleSchema } from "./BaseDropRuleSchema";
import { DropRuleTypeSchema } from "./DropRuleTypeSchema";

/**
 * A rule that enables a selected drop only when all of its conditions pass.
 *
 * Every configured enable rule is a positive emission gate. A failed gate
 * discards the selected drop without rerolling or choosing a replacement.
 */
export const EnableDropRuleSchema = z
	.object({
		...BaseDropRuleSchema.shape,
		/**
		 * Identifies this rule as an enable gate for the selected drop.
		 */
		type: DropRuleTypeSchema.extract([
			"Enable",
		]).describe("Identifies this rule as an enable gate for the selected drop."),
	})
	.strict()
	.meta({
		id: "drop.rule.EnableSchema",
		description: "A rule that enables a selected drop when its conditions pass.",
	});

export type EnableDropRuleSchema = typeof EnableDropRuleSchema;

export namespace EnableDropRuleSchema {
	export type Type = z.infer<EnableDropRuleSchema>;
}
