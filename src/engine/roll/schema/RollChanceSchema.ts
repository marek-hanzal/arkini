import { z } from "zod";

import { DropSchema } from "~/engine/output/schema/DropSchema";
import { ChanceSchema } from "~/engine/common/schema/ChanceSchema";

import { BaseRollSchema } from "./BaseRollSchema";
import { RollEnumSchema } from "./RollEnumSchema";

/**
 * An output roll that will provide its output according to a probability.
 */
export const RollChanceSchema = z
	.object({
		...BaseRollSchema.shape,
		type: RollEnumSchema.extract(["Chance"]),
		/**
		 * Probability that this roll provides its output, from 0 to 1 inclusive.
		 */
		chance: ChanceSchema.describe(
			"The probability that this roll provides its output, from 0 to 1 inclusive.",
		),
		/**
		 * One or more items emitted when this roll succeeds.
		 */
		drop: z
			.tuple(
				[
					DropSchema,
				],
				DropSchema,
			)
			.describe("One or more items emitted when this roll succeeds."),
	})
	.strict()
	.meta({
		id: "RollChanceSchema",
		description: "A roll that provides its output according to a probability.",
	});

export type RollChanceSchema = typeof RollChanceSchema;

export namespace RollChanceSchema {
	export type Type = z.infer<RollChanceSchema>;
}
