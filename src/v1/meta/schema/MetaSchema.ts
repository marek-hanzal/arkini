import { z } from "zod";

import { GridSizeSchema } from "~/v1/grid/schema/GridSizeSchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { TitleSchema } from "~/v1/common/schema/TitleSchema";

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
		board: GridSizeSchema.describe("The size of the board on which items are placed."),
		/**
		 * Size of the inventory grid available to the player.
		 */
		inventory: GridSizeSchema.describe(
			"The size of the inventory grid available to the player.",
		),
	})
	.strict()
	.describe("Core metadata and player-available layouts for a game.");

export type MetaSchema = typeof MetaSchema;

export namespace MetaSchema {
	export type Type = z.infer<MetaSchema>;
}
