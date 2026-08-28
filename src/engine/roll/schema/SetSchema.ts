import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { RollSchema } from "./RollSchema";

/**
 * An alternative non-empty collection of output rolls.
 *
 * An output selects exactly one roll set according to the relative weights of
 * its sets, then evaluates every roll in the selected set.
 */
export const SetSchema = z
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
		id: "roll.SetSchema",
		description: "An alternative non-empty collection of output rolls.",
	});

export type SetSchema = typeof SetSchema;

export namespace SetSchema {
	export type Type = z.infer<SetSchema>;
}
