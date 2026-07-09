import { z } from "zod";

import { VersionEnumSchema } from "./VersionEnumSchema";
import { ItemSchema } from "./ItemSchema";

/**
 * The root schema for a game's configuration.
 *
 * New game-wide configuration fields are added here as the schema is expanded.
 */
export const GameSchema = z
	.object({
		version: VersionEnumSchema,
		items: z.array(ItemSchema),
	})
	.strict()
	.describe("The root configuration for a game.");

export type GameSchema = typeof GameSchema;

export namespace GameSchema {
	export type Type = z.infer<GameSchema>;
}
