import { z } from "zod";

import { DropSchema } from "../output/DropSchema";
import { PositiveIntegerSchema } from "../util/PositiveIntegerSchema";

/**
 * Items that may be selected by a weight-based output roll.
 *
 * The relative weight determines this drop's likelihood among the other
 * configured weighted drops.
 */
export const DropWeightSchema = z
	.object({
		/**
		 * Relative likelihood of selecting this drop among the weighted drops.
		 */
		weight: PositiveIntegerSchema.describe(
			"The positive integer weight used to select this drop.",
		),
		/**
		 * One or more items emitted when this weighted drop is selected.
		 */
		drop: z
			.tuple(
				[
					DropSchema,
				],
				DropSchema,
			)
			.describe("One or more items emitted when this weighted drop is selected."),
	})
	.strict()
	.describe("Items and their relative weight in a weight-based output roll.");

export type DropWeightSchema = typeof DropWeightSchema;

export namespace DropWeightSchema {
	export type Type = z.infer<DropWeightSchema>;
}
