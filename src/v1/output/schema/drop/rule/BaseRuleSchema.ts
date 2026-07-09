import { z } from "zod";
import { WhenSchema } from "../../../../when/schema/WhenSchema";

/**
 * Fields shared by every rule evaluated for a selected drop.
 *
 * Specialized drop-rule schemas spread `BaseRuleSchema.shape` to preserve this
 * common contract while adding their discriminator and rule-specific fields.
 */
export const BaseRuleSchema = z
	.object({
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
	.describe("The common fields shared by every selected-drop rule.");

export type BaseRuleSchema = typeof BaseRuleSchema;

export namespace BaseRuleSchema {
	export type Type = z.infer<BaseRuleSchema>;
}
