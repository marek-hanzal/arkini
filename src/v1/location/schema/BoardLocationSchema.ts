import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { PositionSchema } from "~/v1/grid/schema/PositionSchema";

/** One concrete board-space location usable as a spatial gameplay origin. */
export const BoardLocationSchema = z
	.object({
		scope: z.literal("board"),
		space: NonNegativeIntegerSchema.describe("The explicit board space containing the item."),
		position: PositionSchema.describe("The coordinates inside the board space."),
	})
	.strict()
	.meta({
		id: "BoardLocationSchema",
		description: "One concrete board-space location usable as a spatial gameplay origin.",
	});

export type BoardLocationSchema = typeof BoardLocationSchema;

export namespace BoardLocationSchema {
	export type Type = z.infer<BoardLocationSchema>;
}
