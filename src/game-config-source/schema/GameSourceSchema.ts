import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { MetaSchema } from "~/game-config/schema/MetaSchema";
import { StartSchema } from "~/game-start/schema/StartSchema";
import { RolesSchema } from "~/game-config/schema/RolesSchema";
import { MusicSchema } from "~/game-config/schema/MusicSchema";
import { SfxSchema } from "~/game-config/schema/SfxSchema";

/**
 * Internal assembly value shared by the canonical `game.json` root and
 * `items/<uid>.json` project files.
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
		 * Optional global Music behavior contributed by this source fragment.
		 */
		music: MusicSchema.optional().describe(
			"The optional global Music behavior contributed by this source fragment.",
		),
		/**
		 * Optional SFX event assignments contributed by this source fragment.
		 */
		sfx: SfxSchema.optional().describe(
			"The optional SFX event assignments contributed by this source fragment.",
		),
		/**
		 * Optional reusable templates contributed by this source fragment.
		 */
		templates: GameConfigSchema.shape.templates,
		start: StartSchema.optional().describe(
			"The optional initial Board state contributed by this source fragment.",
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
		$id: "urn:serakki:schema:game-source",
		title: "Serakki game source",
		description: "The internal assembly value for one canonical game project.",
	});

export type GameSourceSchema = typeof GameSourceSchema;

export namespace GameSourceSchema {
	export type Type = z.infer<GameSourceSchema>;
}
