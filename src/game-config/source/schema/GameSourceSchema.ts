import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { MetaSchema } from "~/engine/meta/schema/MetaSchema";
import { StartSchema } from "~/engine/start/schema/StartSchema";
import { RolesSchema } from "~/game-config/resource/schema/RolesSchema";

/**
 * Internal assembly value shared by the canonical `game.json` root and
 * `items/<type>/<uid>.json` project files.
 */
export const GameSourceSchema = z
	.object({
		/**
		 * Optional JSON Schema reference used by configuration authoring tools.
		 */
		$schema: z
			.string()
			.min(1)
			.optional()
			.describe("The optional JSON Schema reference used by configuration authoring tools."),
		/**
		 * Optional game metadata contributed by this source fragment.
		 */
		meta: MetaSchema.optional().describe(
			"The optional game metadata contributed by this source fragment.",
		),
		/**
		 * Optional named non-item resources contributed by this source fragment.
		 */
		resources: RolesSchema.optional().describe(
			"The optional named non-item resources contributed by this source fragment.",
		),
		/**
		 * Optional new-game state contributed by this source fragment.
		 */
		start: StartSchema.optional().describe(
			"The optional initial board, inventory, and toolbar state contributed by this source fragment.",
		),
		/**
		 * Optional canonical items contributed by this source fragment.
		 */
		items: z
			.record(IdSchema, ItemSchema)
			.optional()
			.describe("The optional canonical items contributed by this source fragment."),
	})
	.strict()
	.meta({
		id: "GameSourceSchema",
		$id: "urn:arkini:schema:game-source",
		title: "Arkini game source",
		description: "The internal assembly value for one canonical game project.",
	});

export type GameSourceSchema = typeof GameSourceSchema;

export namespace GameSourceSchema {
	export type Type = z.infer<GameSourceSchema>;
}
