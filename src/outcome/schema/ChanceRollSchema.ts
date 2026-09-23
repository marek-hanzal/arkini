import { z } from "zod";

import { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";

import { RollTypeSchema } from "./RollTypeSchema";

const ProbabilitySchema = z.number().min(0).max(1).meta({
	id: "ChanceSchema",
	description: "A probability from zero to one inclusive.",
});

/**
 * An outcome roll that will provide its outcome according to a probability.
 */
export const ChanceRollSchema = z
	.object({
		type: RollTypeSchema.extract([
			"Chance",
		]),
		/**
		 * Probability that this roll provides its outcome, from 0 to 1 inclusive.
		 */
		chance: ProbabilitySchema.describe(
			"The probability that this roll provides its outcome, from 0 to 1 inclusive.",
		),
		/**
		 * One or more outcomes emitted when this roll succeeds.
		 */
		outcome: z
			.tuple(
				[
					OutcomeSchema,
				],
				OutcomeSchema,
			)
			.describe("One or more outcomes emitted when this roll succeeds."),
	})
	.strict()
	.meta({
		id: "roll.ChanceSchema",
		description: "A roll that provides its outcome according to a probability.",
	});

export type ChanceRollSchema = typeof ChanceRollSchema;

export namespace ChanceRollSchema {
	export type Type = z.infer<ChanceRollSchema>;
}
