import { z } from "zod";

import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

/**
 * How far one gameplay query may search through the runtime world.
 *
 * `universe` is query reach only and is never a valid item storage scope.
 */
export const QueryScopeEnumSchema = z
	.enum([
		...StorageScopeEnumSchema.options,
		"universe",
	])
	.meta({
		id: "QueryScopeEnumSchema",
		description:
			"The board, exact passive storage, local combined, or universe-wide reach of one gameplay query.",
	});

export type QueryScopeEnumSchema = typeof QueryScopeEnumSchema;

export namespace QueryScopeEnumSchema {
	export type Type = z.infer<QueryScopeEnumSchema>;
}
