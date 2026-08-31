import { z } from "zod";

import { DropSchema } from "~/production-output/schema/DropSchema";

import { BaseRollSchema } from "./BaseRollSchema";
import { RollTypeSchema } from "./RollTypeSchema";

const ProbabilitySchema = z.number().min(0).max(1).meta({
	id: "ChanceSchema",
	description: "A probability from zero to one inclusive.",
});

/**
 * An output roll that will provide its output according to a probability.
 */
export const ChanceRollSchema = z
	.object({
		...BaseRollSchema.shape,
		type: RollTypeSchema.extract([
			"Chance",
		]),
		/**
		 * Probability that this roll provides its output, from 0 to 1 inclusive.
		 */
		chance: ProbabilitySchema.describe(
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
		id: "roll.ChanceSchema",
		description: "A roll that provides its output according to a probability.",
	});

export type ChanceRollSchema = typeof ChanceRollSchema;

export namespace ChanceRollSchema {
	export type Type = z.infer<ChanceRollSchema>;
}
