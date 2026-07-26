import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/**
 * Describes the visual representation of a game item.
 *
 * The ordered source list always has at least one asset. Craft and blueprint
 * tiles distribute their entries from an empty to a completely filled material
 * line; other item kinds render the first entry. When `composite` is set, the
 * renderer composes that secondary asset with the selected source asset.
 */
export const AssetSchema = z
	.object({
		/**
		 * Ordered primary asset IDs from the empty to the fully filled visual.
		 */
		source: z
			.tuple(
				[
					IdSchema,
				],
				IdSchema,
			)
			.describe(
				"The ordered primary asset IDs from the empty to the fully filled visual representation.",
			),
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
