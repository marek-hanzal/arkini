import { z } from "zod";
import { RollSetSchema } from "~/outcome/schema/RollSetSchema";

/**
 * A named result produced by a gameplay source such as a production line or stash.
 */
export const OutcomeTableSchema = z
	.object({
		/**
		 * One or more alternative roll sets that this outcome may provide.
		 *
		 * For example, it can grant guaranteed wood when a tree is nearby or reduce
		 * a farm's efficiency when pollution is nearby.
		 */
		set: z
			.tuple(
				[
					RollSetSchema,
				],
				RollSetSchema,
			)
			.describe("One or more alternative roll sets provided by this outcome."),
	})
	.strict()
	.meta({
		id: "OutcomeTableSchema",
		description: "A configured outcome produced by a gameplay source.",
	});

export type OutcomeTableSchema = typeof OutcomeTableSchema;

export namespace OutcomeTableSchema {
	export type Type = z.infer<OutcomeTableSchema>;
}
