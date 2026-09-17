import { z } from "zod";

import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { DropRuleSchema } from "./DropRuleSchema";
import { RollSchema } from "./RollSchema";

/**
 * An alternative non-empty collection of output rolls.
 *
 * An output filters available sets by their rules, selects one by relative weight,
 * then evaluates every roll in that set. No available set means no output.
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
		rules: z
			.array(DropRuleSchema)
			.describe("Availability rules evaluated before this set enters weighted selection."),
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

export type RollSetSchema = typeof RollSetSchema;

export namespace RollSetSchema {
	export type Type = z.infer<RollSetSchema>;
}
