import { z } from "zod";

import { NonEmptyStringSchema } from "~/engine/common/schema/NonEmptyStringSchema";
import { WhenSchema } from "~/production-condition/schema/WhenSchema";

/** Fields shared by availability rules for immediate item actions. */
export const BaseRuleSchema = z
	.object({
		hint: NonEmptyStringSchema.optional().describe(
			"Player-facing explanation shown while this action rule applies.",
		),
		when: z
			.tuple(
				[
					WhenSchema,
				],
				WhenSchema,
			)
			.describe("Conditions that must all pass for this action rule to apply."),
	})
	.strict()
	.meta({
		id: "action.BaseRuleSchema",
		description: "The common fields shared by immediate item-action rules.",
	});

export type BaseRuleSchema = typeof BaseRuleSchema;

export namespace BaseRuleSchema {
	export type Type = z.infer<BaseRuleSchema>;
}
