import { z } from "zod";

import { DistanceSchema } from "~/item-location/schema/DistanceSchema";

import { ScopeSchema } from "./ScopeSchema";
import { BaseSchema } from "./BaseSchema";

/**
 * A query that selects matching board items within a declared distance.
 */
export const BoardSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this query as a board-only query.
		 */
		scope: ScopeSchema.extract([
			"Board",
		]).describe("Identifies this query as a board-only query."),
		/**
		 * Chebyshev distance rule from the query origin to a matching item.
		 *
		 * `self` matches the origin, `close` exactly distance one, `near` exactly
		 * distance two, and `far` every positive distance.
		 */
		distance: DistanceSchema.describe(
			"The origin itself, an exact close or near Chebyshev distance, or any positive far distance.",
		),
	})
	.strict()
	.meta({
		id: "query.BoardSchema",
		description: "A board-only item query constrained by a required board distance.",
	});

export type BoardSchema = typeof BoardSchema;

export namespace BoardSchema {
	export type Type = z.infer<BoardSchema>;
}
