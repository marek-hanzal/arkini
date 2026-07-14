import { z } from "zod";

/**
 * Discriminates how a resolved item drop attempts board placement.
 *
 * This strategy controls only board placement. Inventory fallback is evaluated
 * independently from the emitted item's storage scope.
 */
export const PlacementEnumSchema = z
	.enum([
		/**
		 * Places the drop at the nearest allowed board location from its source,
		 * ordered by Manhattan distance.
		 */
		"drop",
		/**
		 * Places the drop at a random free board location.
		 */
		"random",
	])
	.meta({
		id: "PlacementEnumSchema",
		description:
			"How a resolved item drop attempts board placement, independently from inventory fallback.",
	});

export type PlacementEnumSchema = typeof PlacementEnumSchema;

export namespace PlacementEnumSchema {
	export type Type = z.infer<PlacementEnumSchema>;
}
