import { z } from "zod";

import { QueryAnySchema } from "./QueryAnySchema";
import { QueryBoardSchema } from "./QueryBoardSchema";
import { QueryInventorySchema } from "./QueryInventorySchema";
import { QueryUniverseSchema } from "./QueryUniverseSchema";

/**
 * A runtime item query selected by its search scope.
 *
 * Board queries require distance. Inventory, local combined, and universe-wide queries
 * omit it because they can include items with no comparable board position.
 */
export const QuerySchema = z
	.discriminatedUnion("scope", [
		QueryBoardSchema,
		QueryInventorySchema,
		QueryAnySchema,
		QueryUniverseSchema,
	])
	.meta({
		id: "QuerySchema",
		description:
			"A board, inventory, origin-space-plus-inventory, or universe-wide item query selected by scope.",
	});

export type QuerySchema = typeof QuerySchema;

export namespace QuerySchema {
	export type Type = z.infer<QuerySchema>;
}
