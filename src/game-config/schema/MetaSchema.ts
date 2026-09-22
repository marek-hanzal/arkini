import { z } from "zod";

import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { TitleSchema } from "~/game-value/schema/TitleSchema";

/**
 * Core metadata that defines the game and the layouts available to the player.
 */
export const MetaSchema = z
	.object({
		/**
		 * Stable ID of this game configuration.
		 */
		id: IdSchema.describe("The stable ID of this game configuration."),
		/**
		 * Human-readable title of this game.
		 */
		title: TitleSchema.describe("The human-readable title of this game."),
		introduction: z
			.string()
			.optional()
			.describe("Optional Markdown shown before starting a game without a save."),
		/**
		 * Size of the board on which board items are placed.
		 */
		board: SizeSchema.describe("The size of the board on which items are placed."),
	})
	.strict()
	.meta({
		id: "MetaSchema",
		description: "Core metadata and player-available layouts for a game.",
	});

export type MetaSchema = typeof MetaSchema;

export namespace MetaSchema {
	export type Type = z.infer<MetaSchema>;
}
