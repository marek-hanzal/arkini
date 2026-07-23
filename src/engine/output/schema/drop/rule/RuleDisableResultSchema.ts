import { z } from "zod";

import { BaseRuleResultSchema } from "./BaseRuleResultSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * Evaluation result of one selected-drop disable rule.
 */
export const RuleDisableResultSchema = z
	.object({
		...BaseRuleResultSchema.shape,
		type: RuleEnumSchema.extract([
			"Disable",
		]).describe("Identifies this result as an evaluated selected-drop disable rule."),
	})
	.strict()
	.meta({
		id: "DropRuleDisableResultSchema",
		description: "The evaluation result of one selected-drop disable rule.",
	});

export type RuleDisableResultSchema = typeof RuleDisableResultSchema;

export namespace RuleDisableResultSchema {
	export type Type = z.infer<RuleDisableResultSchema>;
}
