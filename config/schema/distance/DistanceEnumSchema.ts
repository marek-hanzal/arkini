import { z } from "zod";

/**
 * Discriminates the board distance used by future distance-based rules.
 */
export const DistanceEnumSchema = z
	.enum([
		/**
		 * Directly adjacent to the source item, at distance one.
		 */
		"close",
		/**
		 * In the source item's neighbourhood, at distance two.
		 */
		"near",
		/**
		 * Anywhere on the board, regardless of the distance from the source item.
		 */
		"far",
	])
	.describe("The board distance used by a distance-based gameplay rule.");

export type DistanceEnumSchema = typeof DistanceEnumSchema;

export namespace DistanceEnumSchema {
	export type Type = z.infer<DistanceEnumSchema>;
}
