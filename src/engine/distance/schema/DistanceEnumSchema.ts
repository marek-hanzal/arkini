import { z } from "zod";

/**
 * Discriminates the board distance used by future distance-based rules.
 */
export const DistanceEnumSchema = z
	.enum([
		/**
		 * Exactly one Chebyshev board cell away from the source item.
		 */
		"close",
		/**
		 * Exactly two Chebyshev board cells away from the source item.
		 */
		"near",
		/**
		 * Any positive Chebyshev distance from the source item.
		 *
		 * This includes distances classified as `close` and `near`, but excludes
		 * the source item itself at distance zero.
		 */
		"far",
	])
	.meta({
		id: "DistanceEnumSchema",
		description:
			"An exact close or near Chebyshev distance, or any positive far distance excluding the source cell.",
	});

export type DistanceEnumSchema = typeof DistanceEnumSchema;

export namespace DistanceEnumSchema {
	export type Type = z.infer<DistanceEnumSchema>;
}
