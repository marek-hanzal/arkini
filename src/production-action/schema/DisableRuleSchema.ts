import { z } from "zod";

import { RuleTypeSchema } from "./RuleTypeSchema";
import { BaseRuleSchema } from "./BaseRuleSchema";

/** A conditional availability veto for an immediate item action. */
export const DisableRuleSchema = z
	.object({
		...BaseRuleSchema.shape,
		type: RuleTypeSchema.extract([
			"Disable",
		]),
	})
	.strict()
	.meta({
		id: "action.DisableRuleSchema",
		description: "A rule that disables an immediate item action when its conditions pass.",
	});

export type DisableRuleSchema = typeof DisableRuleSchema;

export namespace DisableRuleSchema {
	export type Type = z.infer<DisableRuleSchema>;
}
