import { z } from "zod";

/**
 * Discriminates the board distance used by future distance-based rules.
 */
export const DistanceEnumSchema = z
	.enum({
		Close: "close",
		Near: "near",
		Far: "far",
	})
	.meta({
		id: "DistanceEnumSchema",
		description:
			"An exact close or near Chebyshev distance, or any positive far distance excluding the source cell.",
	});

export type DistanceEnumSchema = typeof DistanceEnumSchema;

export namespace DistanceEnumSchema {
	export type Type = z.infer<DistanceEnumSchema>;
}
