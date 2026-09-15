import { z } from "zod";

import { CompositionSchema } from "./CompositionSchema";

/**
 * Describes the visual representation of a game item.
 *
 * `default` is the complete one- or two-layer composition.
 */
export const ArtworkSchema = z
	.object({
		scale: z
			.number()
			.min(0.25)
			.max(1)
			.describe("The artwork canvas scale within its full tile, from 0.25 through 1."),
		/**
		 * Complete default composition in authoritative back-to-front order.
		 */
		default: CompositionSchema.describe(
			"The default one- or two-layer visual composition in back-to-front order.",
		),
	})
	.strict()
	.meta({
		id: "ArtworkSchema",
		description: "The visual artwork definition for a game item.",
	});

export type ArtworkSchema = typeof ArtworkSchema;

export namespace ArtworkSchema {
	export type Type = z.infer<ArtworkSchema>;
}
