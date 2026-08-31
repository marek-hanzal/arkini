import { z } from "zod";

import { QuantitySchema } from "~/item-definition/schema/QuantitySchema";

import { BaseRollSchema } from "./BaseRollSchema";
import { RollTypeSchema } from "./RollTypeSchema";
import { WeightedDropSchema } from "./WeightedDropSchema";

/**
 * An output roll that will select its output according to relative item weights.
 */
export const WeightedRollSchema = z
	.object({
		...BaseRollSchema.shape,
		type: RollTypeSchema.extract([
			"Weight",
		]),
		/**
		 * Number of independent weighted selections made by this roll.
		 *
		 * Each selection chooses one weighted drop candidate and emits all of its
		 * configured drops. Candidates may therefore be selected more than once.
		 */
		quantity: QuantitySchema.describe(
			"The number of independent weighted selections made by this roll.",
		),
		/**
		 * At least two weighted drop candidates from which this roll selects.
		 */
		drop: z
			.tuple(
				[
					WeightedDropSchema,
					WeightedDropSchema,
				],
				WeightedDropSchema,
			)
			.describe("At least two weighted drop candidates selected by this roll."),
	})
	.strict()
	.meta({
		id: "roll.WeightSchema",
		description: "A roll that selects its output according to relative item weights.",
	});

export type WeightedRollSchema = typeof WeightedRollSchema;

export namespace WeightedRollSchema {
	export type Type = z.infer<WeightedRollSchema>;
}
