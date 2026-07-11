import { z } from "zod";

import { DropSchema } from "~/v1/output/schema/DropSchema";

/**
 * Drop configurations selected by one roll.
 *
 * The drops are not resolved yet: quantity, rules, and placement belong to
 * later, independently composable runtime steps.
 *
 * An empty `drop` array is an intentional valid runtime result. For example, a
 * chance roll that does not pass selects no drops. This differs from configured
 * roll schemas, whose drop collections are non-empty by construction. Do not
 * replace this array with a non-empty tuple.
 */
export const RollResultSchema = z
	.object({
		/**
		 * Drop configurations selected by this roll.
		 *
		 * The array intentionally permits zero entries when a valid roll evaluation
		 * selects nothing, such as a failed chance roll.
		 */
		drop: z
			.array(DropSchema)
			.describe(
				"The unresolved drop configurations selected by this roll; intentionally empty when a valid roll selects no drops.",
			),
	})
	.strict()
	.meta({
		id: "RollResultSchema",
		description:
			"The unresolved, intentionally possibly empty drop configurations selected by one roll.",
	});

export type RollResultSchema = typeof RollResultSchema;

export namespace RollResultSchema {
	export type Type = z.infer<RollResultSchema>;
}
