import { z } from "zod";

import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { CategorySchema } from "~/engine/category/schema/CategorySchema";
import { MetaSchema } from "~/engine/meta/schema/MetaSchema";
import { StartSchema } from "~/engine/start/schema/StartSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ResourceConfigSchema } from "~/engine/resource/schema/ResourceConfigSchema";
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
		 * Explicit non-item resource roles used by the game shell.
		 */
		resources: ResourceConfigSchema.describe(
			"Explicit non-item resource roles used by the game shell.",
		),
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
