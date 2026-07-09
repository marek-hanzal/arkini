import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { MetaSchema } from "~/v1/meta/schema/MetaSchema";
import { VersionEnumSchema } from "./VersionEnumSchema";

/**
 * One authoring fragment that contributes data to a complete game configuration.
 *
 * Game source data is intentionally split across files such as `game.json` and
 * `era-I/items/*.json`. Each fragment is valid independently; the source
 * compiler merges all fragments and validates the completed result with
 * `GameSchema`.
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
