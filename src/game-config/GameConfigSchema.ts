import { z } from "zod";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { MetaSchema } from "~/game-config/MetaSchema";
import { StartSchema } from "~/game-start/schema/StartSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { RolesSchema } from "~/game-config/resource/schema/RolesSchema";

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
		resources: RolesSchema.describe("Explicit non-item resource roles used by the game shell."),
		/**
		 * Board and inventory contents created for a new game.
		 */
		start: StartSchema.describe(
			"The initial board, inventory, and toolbar contents created for a new game.",
		),
		/**
		 * Canonical game items keyed by their unique identifier.
		 */
		items: z
			.record(IdSchema, ItemSchema)
			.describe("Canonical game items keyed by a non-empty identifier."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:game-config",
		title: "Arkini game configuration",
		description: "The root configuration for a game.",
	});

export type GameConfigSchema = typeof GameConfigSchema;

export namespace GameConfigSchema {
	export type Type = z.infer<GameConfigSchema>;
}
