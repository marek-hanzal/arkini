import { z } from "zod";

import { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";

/**
 * One concrete board or inventory grid location.
 */
export const GridLocationSchema = z
	.object({
		/**
		 * Concrete grid currently containing the item.
		 */
		scope: ScopeEnumSchema.extract([
			"board",
			"inventory",
		]).describe("The concrete board or inventory grid containing the item."),
		/**
		 * Coordinates of the item inside its current grid.
		 */
		position: PositionSchema.describe("The coordinates inside the current grid."),
	})
	.strict()
	.meta({
		id: "GridLocationSchema",
		description: "One concrete board or inventory grid location.",
	});

export type GridLocationSchema = typeof GridLocationSchema;

export namespace GridLocationSchema {
	export type Type = z.infer<GridLocationSchema>;
}
