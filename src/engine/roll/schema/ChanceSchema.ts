import { z } from "zod";

import { DropSchema } from "~/engine/output/schema/DropSchema";
import { ChanceSchema as ProbabilitySchema } from "~/engine/common/schema/ChanceSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An output roll that will provide its output according to a probability.
 */
export const ChanceSchema = z
	.object({
		...BaseSchema.shape,
		type: TypeSchema.extract([
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

export type ChanceSchema = typeof ChanceSchema;

export namespace ChanceSchema {
	export type Type = z.infer<ChanceSchema>;
}
