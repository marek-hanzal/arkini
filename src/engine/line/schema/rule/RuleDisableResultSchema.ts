import { z } from "zod";

import { BaseRuleResultSchema } from "./BaseRuleResultSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * Evaluation result of one conditional availability veto.
 */
export const RuleDisableResultSchema = z
	.object({
		...BaseRuleResultSchema.shape,
		type: RuleEnumSchema.extract([
			"Disable",
		]).describe("Identifies this result as an evaluated product-line disable rule."),
	})
	.strict()
	.meta({
		id: "LineRuleDisableResultSchema",
		description: "The evaluation result of one product-line disable rule.",
	});

export type RuleDisableResultSchema = typeof RuleDisableResultSchema;

export namespace RuleDisableResultSchema {
	export type Type = z.infer<RuleDisableResultSchema>;
}
