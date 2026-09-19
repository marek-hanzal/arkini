import { z } from "zod";

/** Authored Chebyshev reach within the query origin Board. */
export const DistanceSchema = z
	.enum({
		Self: "self",
		Close: "close",
		NearClose: "near-close",
		Near: "near",
		Far: "far",
	})
	.meta({
		id: "DistanceSchema",
		description:
			"Chebyshev distance: self is 0, close is 1, near-close is 1 or 2, near is 2, and far is any positive distance.",
	});

export type DistanceSchema = typeof DistanceSchema;

export namespace DistanceSchema {
	export type Type = z.infer<DistanceSchema>;
}
