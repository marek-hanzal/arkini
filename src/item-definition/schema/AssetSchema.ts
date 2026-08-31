import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { CompositionSchema } from "./CompositionSchema";

/**
 * Describes the visual representation of a game item.
 *
 * `default` is the complete one- or two-layer composition shown when the engine
 * does not project progress. Optional `sources` are later single-layer progress
 * states. The asset contract itself is item-type agnostic.
 */
export const AssetSchema = z
	.object({
		/**
		 * Complete default composition in authoritative back-to-front order.
		 */
		default: CompositionSchema.describe(
			"The default one- or two-layer visual composition in back-to-front order.",
		),
		/**
		 * Later single-layer states selected by engine-owned progress.
		 */
		sources: z
			.array(IdSchema)
			.min(1)
			.optional()
			.describe("The optional ordered single-layer progress states after the default."),
	})
	.strict()
	.meta({
		id: "AssetSchema",
		description: "The visual asset definition for a game item.",
	});

export type AssetSchema = typeof AssetSchema;

export namespace AssetSchema {
	export type Type = z.infer<AssetSchema>;
}
