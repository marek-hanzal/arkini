import { z } from "zod";

import { QueryBoardSchema } from "~/v1/query/schema/QueryBoardSchema";
import { BaseWhenSchema } from "./BaseWhenSchema";
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
		...BaseWhenSchema.shape,
		/**
		 * Identifies this condition as a board-distance item-count check.
		 */
		type: WhenEnumSchema.extract([
			"distance",
		]).describe("Identifies this condition as a board-distance item-count check."),
		/**
		 * Board query used to select items at the configured distance.
		 */
		query: QueryBoardSchema.describe(
			"The board query used to select items at the configured distance.",
		),
	})
	.strict()
	.meta({
		id: "WhenDistanceSchema",
		description:
			"A condition that checks selected item count at a board distance from a rule source.",
	});

export type WhenDistanceSchema = typeof WhenDistanceSchema;

export namespace WhenDistanceSchema {
	export type Type = z.infer<WhenDistanceSchema>;
}
