import { z } from "zod";

/**
 * Discriminates how a resolved item drop attempts board placement.
 *
 * This strategy controls only board placement. Inventory fallback is evaluated
 * independently from the emitted item's storage scope.
 */
export const PlacementSchema = z
	.enum({
		Drop: "drop",
		Random: "random",
	})
	.meta({
		id: "PlacementSchema",
		description:
			"How a resolved item drop chooses its board origin before canonical nearest-first placement, independently from inventory fallback.",
	});

export type PlacementSchema = typeof PlacementSchema;

export namespace PlacementSchema {
	export type Type = z.infer<PlacementSchema>;
}
