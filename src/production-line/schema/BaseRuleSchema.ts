import { z } from "zod";

import { NonEmptyStringSchema } from "~/game-config/schema/NonEmptyStringSchema";
import { WhenSchema } from "~/production-condition/schema/WhenSchema";

/**
 * Fields shared by every rule evaluated for a product line.
 *
 * Specialized line-rule schemas spread `BaseRuleSchema.shape` to preserve this
 * common contract while adding their discriminator and rule-specific fields.
 */
export const BaseRuleSchema = z
	.object({
		/**
		 * Optional player-facing explanation shown while this rule applies.
		 * Omitted hints keep the rule as background gameplay behavior.
		 */
		hint: NonEmptyStringSchema.optional().describe(
			"Player-facing explanation shown while this product-line rule applies.",
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
			.describe("Conditions that must all pass for this product-line rule to apply."),
	})
	.strict()
	.meta({
		id: "line.rule.BaseSchema",
		description: "The common fields shared by every product-line rule.",
	});

export type BaseRuleSchema = typeof BaseRuleSchema;

export namespace BaseRuleSchema {
	export type Type = z.infer<BaseRuleSchema>;
}
