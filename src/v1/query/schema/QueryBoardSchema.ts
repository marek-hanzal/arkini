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
		 * Chebyshev distance rule from the query origin to a matching item.
		 *
		 * `close` matches exactly distance one, `near` exactly distance two, and
		 * `far` every positive distance. All variants exclude the origin itself at
		 * distance zero.
		 */
		distance: DistanceEnumSchema.describe(
			"The exact close or near Chebyshev distance, or any positive far distance from the query origin.",
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
