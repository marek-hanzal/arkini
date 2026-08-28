import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

import { RuleTypeSchema } from "./RuleTypeSchema";

const BaseActionRuleResultSchema = z
	.object({
		active: z.boolean(),
		failedWhenIndex: NonNegativeIntegerSchema.optional(),
	})
	.strict();

export const ActionRuleEnableResultSchema = z
	.object({
		...BaseActionRuleResultSchema.shape,
		type: RuleTypeSchema.extract([
			"Enable",
		]),
	})
	.strict()
	.meta({
		id: "ActionRuleEnableResultSchema",
		description: "The evaluation result of one immediate-action enable rule.",
	});

export namespace ActionRuleEnableResultSchema {
	export type Type = z.infer<typeof ActionRuleEnableResultSchema>;
}

export const ActionRuleDisableResultSchema = z
	.object({
		...BaseActionRuleResultSchema.shape,
		type: RuleTypeSchema.extract([
			"Disable",
		]),
	})
	.strict()
	.meta({
		id: "ActionRuleDisableResultSchema",
		description: "The evaluation result of one immediate-action disable rule.",
	});

export namespace ActionRuleDisableResultSchema {
	export type Type = z.infer<typeof ActionRuleDisableResultSchema>;
}
