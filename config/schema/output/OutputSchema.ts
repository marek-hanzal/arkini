import { z } from "zod";

import { RollSetSchema } from "../roll/RollSetSchema";
import { DescriptionSchema } from "../util/DescriptionSchema";
import { IdSchema } from "../util/IdSchema";
import { TitleSchema } from "../util/TitleSchema";

/**
 * A named result produced by a gameplay source such as a production line or stash.
 */
export const OutputSchema = z
	.object({
		id: IdSchema,
		title: TitleSchema,
		description: DescriptionSchema,
		/**
		 * One or more alternative roll sets that this output may provide.
		 *
		 * For example, it can grant guaranteed wood when a tree is nearby or reduce
		 * a farm's efficiency when pollution is nearby.
		 */
		roll: z
			.tuple(
				[
					RollSetSchema,
				],
				RollSetSchema,
			)
			.describe("One or more alternative roll sets provided by this output."),
	})
	.strict()
	.describe("A configured output produced by a gameplay source.");

export type OutputSchema = typeof OutputSchema;

export namespace OutputSchema {
	export type Type = z.infer<OutputSchema>;
}
