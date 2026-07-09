import { z } from "zod";

import { BaseRollSchema } from "./BaseRollSchema";
import { RollTypeEnumSchema } from "./RollTypeEnumSchema";
import { WeightDropSchema } from "./WeightDropSchema";

/**
 * An output roll that will select its output according to relative item weights.
 */
export const RollWeightSchema = z
	.object({
		...BaseRollSchema.shape,
		type: RollTypeEnumSchema.extract([
			"weight",
		]),
		/**
		 * At least two weighted drop candidates from which this roll selects.
		 */
		drop: z
			.tuple(
				[
					WeightDropSchema,
					WeightDropSchema,
				],
				WeightDropSchema,
			)
			.describe("At least two weighted drop candidates selected by this roll."),
	})
	.strict()
	.describe("A roll that selects its output according to relative item weights.");

export type RollWeightSchema = typeof RollWeightSchema;

export namespace RollWeightSchema {
	export type Type = z.infer<RollWeightSchema>;
}
