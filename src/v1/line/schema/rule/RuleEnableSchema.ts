import { z } from "zod";

import { BaseRuleSchema } from "./BaseRuleSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * A rule that enables a product line only when all of its conditions pass.
 *
 * Every configured enable rule is a positive availability gate. A failed gate
 * keeps the line visible but prevents it from starting.
 */
export const RuleEnableSchema = z
	.object({
		...BaseRuleSchema.shape,
		/**
		 * Identifies this rule as an enable gate for the line.
		 */
		type: RuleEnumSchema.extract([
			"enable",
		]).describe("Identifies this rule as an enable gate for the product line."),
	})
	.strict()
	.meta({
		id: "LineRuleEnableSchema",
		description: "A rule that enables a product line when its conditions pass.",
	});

export type RuleEnableSchema = typeof RuleEnableSchema;

export namespace RuleEnableSchema {
	export type Type = z.infer<RuleEnableSchema>;
}
