import { z } from "zod";

import { ScopeSchema } from "./ScopeSchema";
import { BaseSchema } from "./BaseSchema";

/**
 * A query that selects matching items from the origin-space board, shared inventory, and toolbar.
 *
 * It intentionally has no distance because inventory candidates have no board
 * position to measure against the query origin.
 */
export const AnySchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this query as one that searches the origin-space board, shared inventory, and toolbar.
		 */
		scope: ScopeSchema.extract([
			"Any",
		]).describe(
			"Identifies this query as one that searches the origin-space board, shared inventory, and toolbar.",
		),
	})
	.strict()
	.meta({
		id: "query.AnySchema",
		description:
			"An item query that searches the origin-space board, shared inventory, and toolbar without a distance.",
	});

export type AnySchema = typeof AnySchema;

export namespace AnySchema {
	export type Type = z.infer<AnySchema>;
}
