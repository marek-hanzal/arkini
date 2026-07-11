import { z } from "zod";

import { BaseRuleResultSchema } from "./BaseRuleResultSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * Evaluation result of one positive availability gate.
 */
export const RuleEnableResultSchema = z
	.object({
		...BaseRuleResultSchema.shape,
		type: RuleEnumSchema.extract([
			"enable",
		]).describe("Identifies this result as an evaluated product-line enable rule."),
	})
	.strict()
	.meta({
		id: "LineRuleEnableResultSchema",
		description: "The evaluation result of one product-line enable rule.",
	});

export type RuleEnableResultSchema = typeof RuleEnableResultSchema;

export namespace RuleEnableResultSchema {
	export type Type = z.infer<RuleEnableResultSchema>;
}
