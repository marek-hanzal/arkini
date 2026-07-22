import { z } from "zod";

import { BaseQuerySchema } from "./BaseQuerySchema";
import { QueryScopeEnumSchema } from "./QueryScopeEnumSchema";

/** A query that selects matching toolbar items without board distance. */
export const QueryToolbarSchema = z
	.object({
		...BaseQuerySchema.shape,
		scope: QueryScopeEnumSchema.extract([
			QueryScopeEnumSchema.enum.Toolbar,
		]).describe("Identifies this query as a toolbar-only query."),
	})
	.strict()
	.meta({
		id: "QueryToolbarSchema",
		description: "A toolbar-only item query without a board distance.",
	});

export type QueryToolbarSchema = typeof QueryToolbarSchema;

export namespace QueryToolbarSchema {
	export type Type = z.infer<QueryToolbarSchema>;
}
