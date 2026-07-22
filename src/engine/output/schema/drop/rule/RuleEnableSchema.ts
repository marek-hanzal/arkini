import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that enables a selected drop only when all of its conditions pass.
 *
 * Every configured enable rule is a positive emission gate. A failed gate
 * discards the selected drop without rerolling or choosing a replacement.
 */
export const RuleEnableSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as an enable gate for the selected drop.
		 */
		type: RuleEnumSchema.extract(["Enable"]).describe("Identifies this rule as an enable gate for the selected drop."),
	})
	.strict()
	.meta({
		id: "DropRuleEnableSchema",
		description: "A rule that enables a selected drop when its conditions pass.",
	});

export type RuleEnableSchema = typeof RuleEnableSchema;

export namespace RuleEnableSchema {
	export type Type = z.infer<RuleEnableSchema>;
}
