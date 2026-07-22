import { z } from "zod";

import { BaseRuleResultSchema } from "./BaseRuleResultSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * Evaluation result of one selected-drop enable rule.
 */
export const RuleEnableResultSchema = z
	.object({
		...BaseRuleResultSchema.shape,
		type: RuleEnumSchema.extract(["Enable"]).describe("Identifies this result as an evaluated selected-drop enable rule."),
	})
	.strict()
	.meta({
		id: "DropRuleEnableResultSchema",
		description: "The evaluation result of one selected-drop enable rule.",
	});

export type RuleEnableResultSchema = typeof RuleEnableResultSchema;

export namespace RuleEnableResultSchema {
	export type Type = z.infer<RuleEnableResultSchema>;
}
