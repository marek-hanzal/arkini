import { z } from "zod";

import { DropSchema } from "~/production-output/schema/DropSchema";
import { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/**
 * Items that may be selected by a weight-based output roll.
 *
 * Availability rules first decide whether the candidate joins the current
 * selection pool. Its relative weight then determines its likelihood among
 * the other available candidates.
 */
export const WeightedDropSchema = z
	.object({
		/**
		 * Availability rules evaluated before this candidate enters selection.
		 */
		rules: z
			.array(DropRuleSchema)
			.describe("Rules that decide whether this candidate enters selection."),
		/**
		 * Relative likelihood among the currently available candidates.
		 */
		weight: PositiveIntegerSchema.describe(
			"The positive integer weight used to select this drop.",
		),
		/**
		 * One or more items emitted when this weighted drop is selected.
		 */
		drop: z
			.tuple(
				[
					DropSchema,
				],
				DropSchema,
			)
			.describe("One or more items emitted when this weighted drop is selected."),
	})
	.strict()
	.meta({
		id: "roll.WeightedDropSchema",
		description: "An optionally available output candidate and its relative selection weight.",
	});

export type WeightedDropSchema = typeof WeightedDropSchema;

export namespace WeightedDropSchema {
	export type Type = z.infer<WeightedDropSchema>;
}
