import { z } from "zod";

import { RuleTypeSchema } from "./RuleTypeSchema";
import { BaseRuleSchema } from "./BaseRuleSchema";

/** A positive availability gate for an immediate item action. */
export const EnableRuleSchema = z
	.object({
		...BaseRuleSchema.shape,
		type: RuleTypeSchema.extract([
			"Enable",
		]),
	})
	.strict()
	.meta({
		id: "action.EnableRuleSchema",
		description: "A rule that enables an immediate item action when its conditions pass.",
	});

export type EnableRuleSchema = typeof EnableRuleSchema;

export namespace EnableRuleSchema {
	export type Type = z.infer<EnableRuleSchema>;
}
