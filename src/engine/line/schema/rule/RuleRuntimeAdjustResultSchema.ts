import { z } from "zod";

import { BaseRuleResultSchema } from "./BaseRuleResultSchema";
import { TypeSchema } from "./TypeSchema";

/** Evaluation result of one conditional runtime adjustment rule. */
export const RuleRuntimeAdjustResultSchema = z
	.object({
		...BaseRuleResultSchema.shape,
		type: TypeSchema.extract([
			"RuntimeAdjust",
		]).describe("Identifies this result as an evaluated runtime adjustment rule."),
		adjustMs: z
			.number()
			.int()
			.describe("The signed active runtime adjustment in milliseconds."),
	})
	.strict()
	.meta({
		id: "LineRuleRuntimeAdjustResultSchema",
		description: "The evaluation result of one product-line runtime adjustment rule.",
	});

export type RuleRuntimeAdjustResultSchema = typeof RuleRuntimeAdjustResultSchema;

export namespace RuleRuntimeAdjustResultSchema {
	export type Type = z.infer<RuleRuntimeAdjustResultSchema>;
}
