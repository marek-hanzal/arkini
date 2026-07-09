import { z } from "zod";

/**
 * Discriminates the board distance used by future distance-based rules.
 */
export const DistanceEnumSchema = z
	.enum([
		/**
		 * Within one Chebyshev board cell of the source item.
		 */
		"close",
		/**
		 * Within two Chebyshev board cells of the source item.
		 */
		"near",
		/**
		 * Anywhere on the board, regardless of distance from the source item.
		 */
		"far",
	])
	.meta({
		id: "DistanceEnumSchema",
		description: "The Chebyshev board distance used by a distance-based gameplay rule.",
	});

export type DistanceEnumSchema = typeof DistanceEnumSchema;

export namespace DistanceEnumSchema {
	export type Type = z.infer<DistanceEnumSchema>;
}
