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
		 * The items and relative weight selected by this roll.
		 */
		drop: WeightDropSchema.describe("The weighted items selected by this roll."),
	})
	.strict()
	.describe("A roll that selects its output according to relative item weights.");

export type RollWeightSchema = typeof RollWeightSchema;

export namespace RollWeightSchema {
	export type Type = z.infer<RollWeightSchema>;
}
