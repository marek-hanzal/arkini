import { z } from "zod";

import { BaseRuleResultSchema } from "./BaseRuleResultSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * Evaluation result of one conditional hide rule.
 */
export const RuleHideResultSchema = z
	.object({
		...BaseRuleResultSchema.shape,
		type: TypeSchema.extract([
			"Hide",
		]).describe("Identifies this result as an evaluated product-line hide rule."),
	})
	.strict()
	.meta({
		id: "LineRuleHideResultSchema",
		description: "The evaluation result of one product-line hide rule.",
	});

export type RuleHideResultSchema = typeof RuleHideResultSchema;

export namespace RuleHideResultSchema {
	export type Type = z.infer<RuleHideResultSchema>;
}
