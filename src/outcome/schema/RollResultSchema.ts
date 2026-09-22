import { z } from "zod";

import { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";

/**
 * Outcome configurations selected by one roll.
 *
 * The outcomes are not resolved yet: quantity, rules, and placement belong to
 * later, independently composable runtime steps.
 *
 * An empty `outcome` array is an intentional valid runtime result. For example, a
 * chance roll that does not pass selects no outcomes. This differs from configured
 * roll schemas, whose outcome collections are non-empty by construction. Do not
 * replace this array with a non-empty tuple.
 */
export const RollResultSchema = z
	.object({
		/**
		 * Outcome configurations selected by this roll.
		 *
		 * The array intentionally permits zero entries when a valid roll evaluation
		 * selects nothing, such as a failed chance roll.
		 */
		outcome: z
			.array(OutcomeSchema)
			.describe(
				"The unresolved outcome configurations selected by this roll; intentionally empty when a valid roll selects no outcomes.",
			),
	})
	.strict()
	.meta({
		id: "RollResultSchema",
		description:
			"The unresolved, intentionally possibly empty outcome configurations selected by one roll.",
	});

export type RollResultSchema = typeof RollResultSchema;

export namespace RollResultSchema {
	export type Type = z.infer<RollResultSchema>;
}
