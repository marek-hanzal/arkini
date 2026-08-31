import { z } from "zod";

import { ScopeSchema } from "./ScopeSchema";
import { BaseSchema } from "./BaseSchema";

/**
 * A query that selects matching inventory items.
 *
 * Inventory has no board position, so this query intentionally has no distance.
 */
export const InventorySchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this query as an inventory-only query.
		 */
		scope: ScopeSchema.extract([
			"Inventory",
		]).describe("Identifies this query as an inventory-only query."),
	})
	.strict()
	.meta({
		id: "query.InventorySchema",
		description: "An inventory-only item query without a board distance.",
	});

export type InventorySchema = typeof InventorySchema;

export namespace InventorySchema {
	export type Type = z.infer<InventorySchema>;
}
