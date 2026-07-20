import { z } from "zod";

import { QueryScopeEnumSchema } from "./QueryScopeEnumSchema";
import { BaseQuerySchema } from "./BaseQuerySchema";

/**
 * A query that selects matching items from the origin-space board, shared inventory, and toolbar.
 *
 * It intentionally has no distance because inventory candidates have no board
 * position to measure against the query origin.
 */
export const QueryAnySchema = z
	.object({
		...BaseQuerySchema.shape,
		/**
		 * Identifies this query as one that searches the origin-space board, shared inventory, and toolbar.
		 */
		scope: QueryScopeEnumSchema.extract([
			"any",
		]).describe(
			"Identifies this query as one that searches the origin-space board, shared inventory, and toolbar.",
		),
	})
	.strict()
	.meta({
		id: "QueryAnySchema",
		description:
			"An item query that searches the origin-space board, shared inventory, and toolbar without a distance.",
	});

export type QueryAnySchema = typeof QueryAnySchema;

export namespace QueryAnySchema {
	export type Type = z.infer<QueryAnySchema>;
}
