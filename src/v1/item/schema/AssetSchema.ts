import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";

/**
 * Describes the visual representation of a game item.
 *
 * The ordered source list always has at least one asset. The runtime currently
 * renders its first entry; a later progress-aware renderer can select a later
 * entry without changing the configuration contract. When `composite` is set,
 * the renderer composes that secondary asset with the selected source asset.
 */
export const AssetSchema = z
	.object({
		/**
		 * Ordered primary asset IDs for this item's visual representation.
		 */
		source: z
			.tuple(
				[
					IdSchema,
				],
				IdSchema,
			)
			.describe("The ordered primary asset IDs for this item's visual representation."),
		/**
		 * Optional secondary asset composed with the selected primary asset.
		 */
		composite: IdSchema.optional().describe(
			"The optional secondary asset composed with the selected primary asset.",
		),
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
