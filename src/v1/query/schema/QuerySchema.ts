import { z } from "zod";

import { QueryAnySchema } from "./QueryAnySchema";
import { QueryBoardSchema } from "./QueryBoardSchema";
import { QueryInventorySchema } from "./QueryInventorySchema";

/**
 * A runtime item query selected by its search scope.
 *
 * Board queries require distance. Inventory and cross-state queries deliberately
 * omit it because they can include items with no board position.
 */
export const QuerySchema = z
	.discriminatedUnion("scope", [
		QueryBoardSchema,
		QueryInventorySchema,
		QueryAnySchema,
	])
	.meta({
		id: "QuerySchema",
		description: "A board, inventory, or cross-state item query selected by scope.",
	});

export type QuerySchema = typeof QuerySchema;

export namespace QuerySchema {
	export type Type = z.infer<QuerySchema>;
}
