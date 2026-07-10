import { z } from "zod";

import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import { BaseQuerySchema } from "./BaseQuerySchema";

/**
 * A query that selects matching items across both board and inventory.
 *
 * It intentionally has no distance because inventory candidates have no board
 * position to measure against the query origin.
 */
export const QueryAnySchema = z
	.object({
		...BaseQuerySchema.shape,
		/**
		 * Identifies this query as one that searches board and inventory.
		 */
		scope: ScopeEnumSchema.extract([
			"any",
		]).describe("Identifies this query as one that searches board and inventory."),
	})
	.strict()
	.meta({
		id: "QueryAnySchema",
		description: "An item query that searches across board and inventory without a distance.",
	});

export type QueryAnySchema = typeof QueryAnySchema;

export namespace QueryAnySchema {
	export type Type = z.infer<QueryAnySchema>;
}
