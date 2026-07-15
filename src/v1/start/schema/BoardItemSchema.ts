import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositionSchema } from "~/v1/grid/schema/PositionSchema";

/**
 * Places one item instance at an explicit cell in the initial board layout.
 */
export const BoardItemSchema = z
	.object({
		...PositionSchema.shape,
		space: NonNegativeIntegerSchema.describe(
			"The explicit board space containing this initial item.",
		),
		/**
		 * Canonical item placed on the board.
		 */
		itemId: IdSchema.describe("The canonical item ID placed on the initial board."),
	})
	.strict()
	.meta({
		id: "start.BoardItemSchema",
		description: "One canonical item placed at an explicit initial board coordinate.",
	});

export type BoardItemSchema = typeof BoardItemSchema;

export namespace BoardItemSchema {
	export type Type = z.infer<BoardItemSchema>;
}
