import { z } from "zod";

import { ActionRuleEnumSchema } from "./ActionRuleEnumSchema";
import { BaseActionRuleSchema } from "./BaseActionRuleSchema";

/** A positive availability gate for an immediate item action. */
export const ActionRuleEnableSchema = z
	.object({
		...BaseActionRuleSchema.shape,
		type: ActionRuleEnumSchema.extract([
			"Enable",
		]),
	})
	.strict()
	.meta({
		id: "ActionRuleEnableSchema",
		description: "A rule that enables an immediate item action when its conditions pass.",
	});

export type ActionRuleEnableSchema = typeof ActionRuleEnableSchema;

export namespace ActionRuleEnableSchema {
	export type Type = z.infer<ActionRuleEnableSchema>;
}
