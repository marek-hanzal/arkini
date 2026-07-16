import { z } from "zod";

import { BaseRollSchema } from "./BaseRollSchema";
import { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import { RollEnumSchema } from "./RollEnumSchema";
import { DropWeightSchema } from "./DropWeightSchema";

/**
 * An output roll that will select its output according to relative item weights.
 */
export const RollWeightSchema = z
	.object({
		...BaseRollSchema.shape,
		type: RollEnumSchema.extract([
			"weight",
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
					DropWeightSchema,
					DropWeightSchema,
				],
				DropWeightSchema,
			)
			.describe("At least two weighted drop candidates selected by this roll."),
	})
	.strict()
	.meta({
		id: "RollWeightSchema",
		description: "A roll that selects its output according to relative item weights.",
	});

export type RollWeightSchema = typeof RollWeightSchema;

export namespace RollWeightSchema {
	export type Type = z.infer<RollWeightSchema>;
}
