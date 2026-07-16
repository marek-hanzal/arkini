import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { RollSchema } from "./RollSchema";

/**
 * An alternative non-empty collection of output rolls.
 *
 * An output selects exactly one roll set according to the relative weights of
 * its sets, then evaluates every roll in the selected set.
 */
export const RollSetSchema = z
	.object({
		/**
		 * Optional relative likelihood of selecting this roll set.
		 *
		 * When omitted, runtime selection treats this set with weight one.
		 */
		weight: PositiveIntegerSchema.optional().describe(
			"The optional positive relative weight used to select this roll set.",
		),
		/**
		 * One or more rolls evaluated after this set is selected.
		 */
		roll: z
			.tuple(
				[
					RollSchema,
				],
				RollSchema,
			)
			.describe("One or more rolls evaluated after this set is selected."),
	})
	.strict()
	.meta({
		id: "RollSetSchema",
		description: "An alternative non-empty collection of output rolls.",
	});

export type RollSetSchema = typeof RollSetSchema;

export namespace RollSetSchema {
	export type Type = z.infer<RollSetSchema>;
}
