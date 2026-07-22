import { z } from "zod";

import { QueryScopeEnumSchema } from "./QueryScopeEnumSchema";
import { BaseQuerySchema } from "./BaseQuerySchema";

/**
 * A query that selects matching inventory items.
 *
 * Inventory has no board position, so this query intentionally has no distance.
 */
export const QueryInventorySchema = z
	.object({
		...BaseQuerySchema.shape,
		/**
		 * Identifies this query as an inventory-only query.
		 */
		scope: QueryScopeEnumSchema.extract(["Inventory"]).describe("Identifies this query as an inventory-only query."),
	})
	.strict()
	.meta({
		id: "QueryInventorySchema",
		description: "An inventory-only item query without a board distance.",
	});

export type QueryInventorySchema = typeof QueryInventorySchema;

export namespace QueryInventorySchema {
	export type Type = z.infer<QueryInventorySchema>;
}
