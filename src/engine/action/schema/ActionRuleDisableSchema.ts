import { z } from "zod";

import { ActionRuleEnumSchema } from "./ActionRuleEnumSchema";
import { BaseActionRuleSchema } from "./BaseActionRuleSchema";

/** A conditional availability veto for an immediate item action. */
export const ActionRuleDisableSchema = z
	.object({
		...BaseActionRuleSchema.shape,
		type: ActionRuleEnumSchema.extract([
			"Disable",
		]),
	})
	.strict()
	.meta({
		id: "ActionRuleDisableSchema",
		description: "A rule that disables an immediate item action when its conditions pass.",
	});

export type ActionRuleDisableSchema = typeof ActionRuleDisableSchema;

export namespace ActionRuleDisableSchema {
	export type Type = z.infer<ActionRuleDisableSchema>;
}
