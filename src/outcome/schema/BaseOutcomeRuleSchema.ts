import { z } from "zod";
import { NonEmptyStringSchema } from "~/game-value/schema/NonEmptyStringSchema";
import { WhenSchema } from "~/production-condition/schema/WhenSchema";

/**
 * Fields shared by every rule evaluated for a selected outcome.
 *
 * Specialized outcome-rule schemas spread `BaseOutcomeRuleSchema.shape` to preserve this
 * common contract while adding their discriminator and rule-specific fields.
 */
export const BaseOutcomeRuleSchema = z
	.object({
		/**
		 * Optional player-facing explanation shown while this rule applies.
		 * Omitted hints keep the rule as background gameplay behavior.
		 */
		hint: NonEmptyStringSchema.optional().describe(
			"Player-facing explanation shown while this selected-outcome rule applies.",
		),
		/**
		 * Conditions that must all pass for this rule to apply.
		 */
		when: z
			.tuple(
				[
					WhenSchema,
				],
				WhenSchema,
			)
			.describe("Conditions that must all pass for this selected-outcome rule to apply."),
	})
	.strict()
	.meta({
		id: "outcome.rule.BaseSchema",
		description: "The common fields shared by every selected-outcome rule.",
	});

export type BaseOutcomeRuleSchema = typeof BaseOutcomeRuleSchema;

export namespace BaseOutcomeRuleSchema {
	export type Type = z.infer<BaseOutcomeRuleSchema>;
}
