import { z } from "zod";

import { DropSchema } from "./DropSchema";
import { PositiveIntegerSchema } from "./util/PositiveIntegerSchema";

/**
 * Items that may be selected by a weight-based output roll.
 *
 * The relative weight determines this drop's likelihood among the other
 * configured weighted drops.
 */
export const WeightDropSchema = z
	.object({
		/**
		 * Relative likelihood of selecting this drop among the weighted drops.
		 */
		weight: PositiveIntegerSchema.describe(
			"The positive integer weight used to select this drop.",
		),
		/**
		 * Items emitted when this weighted drop is selected.
		 */
		drop: z
			.array(DropSchema)
			.describe("The items emitted when this weighted drop is selected."),
	})
	.strict()
	.describe("Items and their relative weight in a weight-based output roll.");

export type WeightDropSchema = typeof WeightDropSchema;

export namespace WeightDropSchema {
	export type Type = z.infer<WeightDropSchema>;
}
