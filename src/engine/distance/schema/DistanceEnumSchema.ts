import { z } from "zod";

/**
 * Discriminates the board distance used by future distance-based rules.
 */
export const DistanceEnumSchema = z
	.enum({
		Self: "self",
		Close: "close",
		Near: "near",
		Far: "far",
	})
	.meta({
		id: "DistanceEnumSchema",
		description:
			"The source cell itself, an exact close or near Chebyshev distance, or any positive far distance.",
	});

export type DistanceEnumSchema = typeof DistanceEnumSchema;

export namespace DistanceEnumSchema {
	export type Type = z.infer<DistanceEnumSchema>;
}
