import { z } from "zod";

import { DistanceEnumSchema } from "../../distance/schema/DistanceEnumSchema";
import { IdSchema } from "../../common/schema/IdSchema";
import { PositiveIntegerSchema } from "../../common/schema/PositiveIntegerSchema";
import { WhenEnumSchema } from "./WhenEnumSchema";

/**
 * A condition that checks the count of one item at a board distance from a rule source.
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
		 * ID of the board item counted at the configured distance.
		 */
		itemId: IdSchema.describe("The ID of the board item counted at the configured distance."),
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
	.describe("A condition that checks item count at a board distance from a rule source.");

export type WhenDistanceSchema = typeof WhenDistanceSchema;

export namespace WhenDistanceSchema {
	export type Type = z.infer<WhenDistanceSchema>;
}
