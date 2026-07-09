import { z } from "zod";

import { BaseRollSchema } from "./BaseRollSchema";
import { DropSchema } from "~/v1/output/schema/DropSchema";
import { RollEnumSchema } from "./RollEnumSchema";
import { ChanceSchema } from "~/v1/common/schema/ChanceSchema";

/**
 * An output roll that will provide its output according to a probability.
 */
export const RollChanceSchema = z
	.object({
		...BaseRollSchema.shape,
		type: RollEnumSchema.extract([
			"chance",
		]),
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
	.describe("A roll that provides its output according to a probability.");

export type RollChanceSchema = typeof RollChanceSchema;

export namespace RollChanceSchema {
	export type Type = z.infer<RollChanceSchema>;
}
