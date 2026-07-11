import { z } from "zod";

import { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { CategorySchema } from "~/v1/category/schema/CategorySchema";
import { MetaSchema } from "~/v1/meta/schema/MetaSchema";
import { StartSchema } from "~/v1/start/schema/StartSchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { VersionEnumSchema } from "./VersionEnumSchema";

/**
 * The root schema for a game's configuration.
 *
 * New game-wide configuration fields are added here as the schema is expanded.
 */
export const GameConfigSchema = z
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
		 * Core metadata and player-available layouts for this game.
		 */
		meta: MetaSchema.describe("Core metadata and player-available layouts for this game."),
		/**
		 * Board and inventory contents created for a new game.
		 */
		start: StartSchema.describe(
			"The initial board and inventory contents created for a new game.",
		),
		/**
		 * Canonical UI-facing categories keyed by their stable identifier.
		 */
		categories: z
			.record(IdSchema, CategorySchema)
			.describe("Canonical UI-facing categories keyed by a non-empty identifier."),
		/**
		 * Version of this game configuration's schema contract.
		 */
		version: VersionEnumSchema,
		/**
		 * Canonical game items keyed by their unique identifier.
		 */
		items: z
			.record(IdSchema, ItemSchema)
			.describe("Canonical game items keyed by a non-empty identifier."),
	})
	.strict()
	.meta({
		id: "GameConfigSchema",
		description: "The root configuration for a game.",
	});

export type GameConfigSchema = typeof GameConfigSchema;

export namespace GameConfigSchema {
	export type Type = z.infer<GameConfigSchema>;
}
