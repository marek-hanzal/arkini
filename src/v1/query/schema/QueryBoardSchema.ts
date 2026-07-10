import { z } from "zod";

import { DistanceEnumSchema } from "~/v1/distance/schema/DistanceEnumSchema";
import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import { BaseQuerySchema } from "./BaseQuerySchema";

/**
 * A query that selects matching board items within a declared distance.
 */
export const QueryBoardSchema = z
	.object({
		...BaseQuerySchema.shape,
		/**
		 * Identifies this query as a board-only query.
		 */
		scope: ScopeEnumSchema.extract([
			"board",
		]).describe("Identifies this query as a board-only query."),
		/**
		 * Maximum board distance from the query origin to a matching item.
		 *
		 * Use `far` to search anywhere on the board.
		 */
		distance: DistanceEnumSchema.describe(
			"The maximum board distance from the query origin; far searches anywhere on the board.",
		),
	})
	.strict()
	.meta({
		id: "QueryBoardSchema",
		description: "A board-only item query constrained by a required board distance.",
	});

export type QueryBoardSchema = typeof QueryBoardSchema;

export namespace QueryBoardSchema {
	export type Type = z.infer<QueryBoardSchema>;
}
