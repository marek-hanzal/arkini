import { z } from "zod";

/**
 * Discriminates how a resolved item drop is placed on the game board.
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
		/**
		 * Replaces the board item that generated this drop.
		 */
		"replace",
	])
	.meta({
		id: "PlacementEnumSchema",
		description: "How a resolved item drop is placed on the game board.",
	});

export type PlacementEnumSchema = typeof PlacementEnumSchema;

export namespace PlacementEnumSchema {
	export type Type = z.infer<PlacementEnumSchema>;
}
