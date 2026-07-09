import { z } from "zod";

import { ItemSchema } from "./ItemSchema";
import { IdSchema } from "./util/IdSchema";
import { VersionEnumSchema } from "./VersionEnumSchema";

/**
 * The root schema for a game's configuration.
 *
 * New game-wide configuration fields are added here as the schema is expanded.
 */
export const GameSchema = z
	.object({
		version: VersionEnumSchema,
		/**
		 * Canonical game items keyed by their unique identifier.
		 */
		items: z
			.record(IdSchema, ItemSchema)
			.describe("Canonical game items keyed by a non-empty identifier."),
	})
	.strict()
	.describe("The root configuration for a game.");

export type GameSchema = typeof GameSchema;

export namespace GameSchema {
	export type Type = z.infer<GameSchema>;
}
