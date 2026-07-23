import { z } from "zod";

import { PositiveNumberSchema } from "~/engine/common/schema/PositiveNumberSchema";

import { BaseRuleResultSchema } from "./BaseRuleResultSchema";
import { RuleEnumSchema } from "./RuleEnumSchema";

/**
 * Evaluation result of one conditional runtime multiplier rule.
 */
export const RuleRuntimeMultiplierResultSchema = z
	.object({
		...BaseRuleResultSchema.shape,
		type: RuleEnumSchema.extract([
			"RuntimeMultiplier",
		]).describe("Identifies this result as an evaluated product-line runtime multiplier rule."),
		multiplier: PositiveNumberSchema.describe(
			"The runtime multiplier contributed when this evaluated rule is active.",
		),
	})
	.strict()
	.meta({
		id: "LineRuleRuntimeMultiplierResultSchema",
		description: "The evaluation result of one product-line runtime multiplier rule.",
	});

export type RuleRuntimeMultiplierResultSchema = typeof RuleRuntimeMultiplierResultSchema;

export namespace RuleRuntimeMultiplierResultSchema {
	export type Type = z.infer<RuleRuntimeMultiplierResultSchema>;
}
