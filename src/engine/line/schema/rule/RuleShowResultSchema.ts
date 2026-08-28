import { z } from "zod";

import { BaseRuleResultSchema } from "./BaseRuleResultSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * Evaluation result of one conditional show rule.
 */
export const RuleShowResultSchema = z
	.object({
		...BaseRuleResultSchema.shape,
		type: TypeSchema.extract([
			"Show",
		]).describe("Identifies this result as an evaluated product-line show rule."),
	})
	.strict()
	.meta({
		id: "LineRuleShowResultSchema",
		description: "The evaluation result of one product-line show rule.",
	});

export type RuleShowResultSchema = typeof RuleShowResultSchema;

export namespace RuleShowResultSchema {
	export type Type = z.infer<RuleShowResultSchema>;
}
