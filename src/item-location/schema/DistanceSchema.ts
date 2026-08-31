import { z } from "zod";

/**
 * Discriminates the board distance used by future distance-based rules.
 */
export const DistanceSchema = z
	.enum({
		Self: "self",
		Close: "close",
		Near: "near",
		Far: "far",
	})
	.meta({
		id: "DistanceSchema",
		description:
			"The source cell itself, an exact close or near Chebyshev distance, or any positive far distance.",
	});

export type DistanceSchema = typeof DistanceSchema;

export namespace DistanceSchema {
	export type Type = z.infer<DistanceSchema>;
}
