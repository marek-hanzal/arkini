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
		 * Relative likelihood of selecting this roll set.
		 *
		 * Authored shorthand without a value is normalized to weight one.
		 */
		weight: PositiveIntegerSchema.default(1).describe(
			"The positive relative weight used to select this roll set.",
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
