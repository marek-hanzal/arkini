import { z } from "zod";
import { NonEmptyStringSchema } from "~/game-config/schema/NonEmptyStringSchema";
import { WhenSchema } from "~/production-condition/schema/WhenSchema";

/**
 * Fields shared by every rule evaluated for a selected drop.
 *
 * Specialized drop-rule schemas spread `BaseSchema.shape` to preserve this
 * common contract while adding their discriminator and rule-specific fields.
 */
export const BaseSchema = z
	.object({
		/**
		 * Optional player-facing explanation shown while this rule applies.
		 * Omitted hints keep the rule as background gameplay behavior.
		 */
		hint: NonEmptyStringSchema.optional().describe(
			"Player-facing explanation shown while this selected-drop rule applies.",
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
			.describe("Conditions that must all pass for this selected-drop rule to apply."),
	})
	.strict()
	.meta({
		id: "drop.rule.BaseSchema",
		description: "The common fields shared by every selected-drop rule.",
	});

export type BaseSchema = typeof BaseSchema;

export namespace BaseSchema {
	export type Type = z.infer<BaseSchema>;
}
