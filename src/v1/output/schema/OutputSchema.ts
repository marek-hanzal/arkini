import { z } from "zod";
import { RollSetSchema } from "~/v1/roll/schema/RollSetSchema";

/**
 * A named result produced by a gameplay source such as a production line or stash.
 */
export const OutputSchema = z
	.object({
		/**
		 * One or more alternative roll sets that this output may provide.
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
			.describe("One or more alternative roll sets provided by this output."),
	})
	.strict()
	.meta({
		id: "OutputSchema",
		description: "A configured output produced by a gameplay source.",
	});

export type OutputSchema = typeof OutputSchema;

export namespace OutputSchema {
	export type Type = z.infer<OutputSchema>;
}
