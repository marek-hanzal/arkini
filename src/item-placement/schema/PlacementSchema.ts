import { z } from "zod";

/**
 * Discriminates how a resolved item drop attempts board placement.
 *
 */
export const PlacementSchema = z
	.enum({
		Drop: "drop",
		Random: "random",
	})
	.meta({
		id: "PlacementSchema",
		description:
			"How a resolved item drop chooses its board origin before canonical nearest-first placement.",
	});

export type PlacementSchema = typeof PlacementSchema;

export namespace PlacementSchema {
	export type Type = z.infer<PlacementSchema>;
}
