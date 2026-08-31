import { z } from "zod";

import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { ToolbarSizeSchema } from "~/item-location/schema/ToolbarSizeSchema";
import { IdSchema } from "~/game-config/schema/IdSchema";
import { TitleSchema } from "~/game-config/schema/TitleSchema";

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
		/**
		 * Size of the board on which board items are placed.
		 */
		board: SizeSchema.describe("The size of the board on which items are placed."),
		/**
		 * Size of the inventory grid available to the player.
		 */
		inventory: SizeSchema.describe("The size of the inventory grid available to the player."),
		/**
		 * Optional number of slots in the one-row passive toolbar. Zero disables it.
		 */
		toolbarSize: ToolbarSizeSchema.optional().describe(
			"The optional one-row toolbar slot count; zero or undefined disables it.",
		),
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
