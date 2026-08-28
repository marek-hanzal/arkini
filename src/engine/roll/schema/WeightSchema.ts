import { z } from "zod";

import { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";
import { WeightedDropSchema } from "./WeightedDropSchema";

/**
 * An output roll that will select its output according to relative item weights.
 */
export const WeightSchema = z
	.object({
		...BaseSchema.shape,
		type: TypeSchema.extract([
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

export type WeightSchema = typeof WeightSchema;

export namespace WeightSchema {
	export type Type = z.infer<WeightSchema>;
}
