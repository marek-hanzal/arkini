import { z } from "zod";

import { DistanceEnumSchema } from "~/v1/distance/schema/DistanceEnumSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";
import { WhenEnumSchema } from "./WhenEnumSchema";

/**
 * A condition that checks the count of selected items at a board distance from a rule source.
 *
 * The condition is satisfied when the matching item count is greater than or
 * equal to `count`. Evaluation excludes the rule source and requires that the
 * source has a board position.
 */
export const WhenDistanceSchema = z
	.object({
		/**
		 * Identifies this condition as a board-distance item-count check.
		 */
		type: WhenEnumSchema.extract([
			"distance",
		]).describe("Identifies this condition as a board-distance item-count check."),
		/**
		 * Strategy used to select the board items counted at the configured distance.
		 */
		selector: SelectorSchema.describe(
			"The strategy used to select the board items counted at the configured distance.",
		),
		/**
		 * Board distance from the rule source at which matching items are counted.
		 */
		distance: DistanceEnumSchema.describe(
			"The board distance from the rule source at which matching items are counted.",
		),
		/**
		 * Minimum number of matching board items required for this condition to pass.
		 */
		count: PositiveIntegerSchema.describe(
			"The minimum number of matching board items required for this condition to pass.",
		),
	})
	.strict()
	.describe(
		"A condition that checks selected item count at a board distance from a rule source.",
	);

export type WhenDistanceSchema = typeof WhenDistanceSchema;

export namespace WhenDistanceSchema {
	export type Type = z.infer<WhenDistanceSchema>;
}
