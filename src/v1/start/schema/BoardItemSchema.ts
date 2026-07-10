import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";

/**
 * Places one item instance at an explicit cell in the initial board layout.
 */
export const BoardItemSchema = z
	.object({
		/**
		 * Canonical item placed on the board.
		 */
		itemId: IdSchema.describe("The canonical item ID placed on the initial board."),
		/**
		 * Zero-based horizontal board coordinate.
		 */
		x: NonNegativeIntegerSchema.describe(
			"The zero-based horizontal coordinate of the initial board item.",
		),
		/**
		 * Zero-based vertical board coordinate.
		 */
		y: NonNegativeIntegerSchema.describe(
			"The zero-based vertical coordinate of the initial board item.",
		),
	})
	.strict()
	.meta({
		id: "BoardItemSchema",
		description: "One canonical item placed at an explicit initial board coordinate.",
	});

export type BoardItemSchema = typeof BoardItemSchema;

export namespace BoardItemSchema {
	export type Type = z.infer<BoardItemSchema>;
}
