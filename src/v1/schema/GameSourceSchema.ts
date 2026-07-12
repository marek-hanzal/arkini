import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { CategorySchema } from "~/v1/category/schema/CategorySchema";
import { MetaSchema } from "~/v1/meta/schema/MetaSchema";
import { StartSchema } from "~/v1/start/schema/StartSchema";
import { ResourceConfigSchema } from "~/v1/resource/schema/ResourceConfigSchema";
import { VersionEnumSchema } from "./VersionEnumSchema";

/**
 * One authoring fragment that contributes data to a complete game configuration.
 *
 * Game source data is intentionally split across files such as `game.json` and
 * `era-I/simple/*.json`. Each fragment is valid independently; the source
 * packer merges all fragments, while the validator owns completed-game checks.
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
		resources: ResourceConfigSchema.optional().describe(
			"The optional named non-item resources contributed by this source fragment.",
		),
		/**
		 * Optional new-game state contributed by this source fragment.
		 */
		start: StartSchema.optional().describe(
			"The optional initial board and inventory state contributed by this source fragment.",
		),
		/**
		 * Optional canonical UI-facing categories contributed by this source fragment.
		 */
		categories: z
			.record(IdSchema, CategorySchema)
			.optional()
			.describe(
				"The optional canonical UI-facing categories contributed by this source fragment.",
			),
		/**
		 * Optional version contributed by this source fragment.
		 */
		version: VersionEnumSchema.optional().describe(
			"The optional version contributed by this source fragment.",
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
		description:
			"One authoring fragment that contributes data to a complete game configuration.",
	});

export type GameSourceSchema = typeof GameSourceSchema;

export namespace GameSourceSchema {
	export type Type = z.infer<GameSourceSchema>;
}
