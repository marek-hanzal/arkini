import { z } from "zod";

import { StorageSchema } from "~/item-definition/schema/StorageSchema";

/**
 * How far one gameplay query may search through the runtime world.
 *
 * `universe` is query reach only and is never a valid item storage scope.
 */
export const ScopeSchema = z
	.enum({
		...StorageSchema.enum,
		Universe: "universe",
	})
	.meta({
		id: "query.ScopeSchema",
		description:
			"The board, exact passive storage, local combined, or universe-wide reach of one gameplay query.",
	});

export type ScopeSchema = typeof ScopeSchema;

export namespace ScopeSchema {
	export type Type = z.infer<ScopeSchema>;
}
