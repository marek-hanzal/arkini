import { z } from "zod";

import { BaseQuerySchema } from "./BaseQuerySchema";
import { QueryScopeEnumSchema } from "./QueryScopeEnumSchema";

/**
 * A query that searches every board space plus the shared inventory.
 *
 * It intentionally has no distance because candidates may belong to different
 * board spaces or have no board position at all.
 */
export const QueryUniverseSchema = z
	.object({
		...BaseQuerySchema.shape,
		scope: QueryScopeEnumSchema.extract([
			"universe",
		]).describe("Searches every board space plus the shared inventory."),
	})
	.strict()
	.meta({
		id: "QueryUniverseSchema",
		description:
			"A universe-wide item query across every board space and the shared inventory without distance.",
	});

export type QueryUniverseSchema = typeof QueryUniverseSchema;

export namespace QueryUniverseSchema {
	export type Type = z.infer<QueryUniverseSchema>;
}
