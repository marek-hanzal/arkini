import { z } from "zod";

/** Authored Board-relative reach or selection across all Board spaces. */
export const DistanceSchema = z
	.enum({
		Self: "self",
		Close: "close",
		NearClose: "near-close",
		Near: "near",
		Far: "far",
		Universe: "universe",
	})
	.meta({
		id: "DistanceSchema",
		description:
			"Chebyshev distance: self is 0, close is 1, near-close is 1 or 2, near is 2, and far is any positive distance within the origin Board. Universe includes all Board spaces and the origin.",
	});

export type DistanceSchema = typeof DistanceSchema;

export namespace DistanceSchema {
	export type Type = z.infer<DistanceSchema>;
}
