import { z } from "zod";

import { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";

/**
 * The concrete runtime or persisted location owned by one live item.
 */
export const LocationSchema = z
	.object({
		/**
		 * Concrete grid currently containing the item.
		 */
		scope: ScopeEnumSchema.extract([
			"board",
			"inventory",
		]).describe("The concrete grid currently containing the item."),
		/**
		 * Coordinates of the item inside its current grid.
		 */
		position: PositionSchema.describe("The coordinates inside the current grid."),
	})
	.strict()
	.meta({
		id: "LocationSchema",
		description: "The concrete grid and coordinates owned by one live item.",
	});

export type LocationSchema = typeof LocationSchema;

export namespace LocationSchema {
	export type Type = z.infer<LocationSchema>;
}
