import { z } from "zod";

import { PositionSchema } from "~/v1/grid/schema/PositionSchema";

/** One concrete board location usable as a spatial gameplay origin. */
export const BoardLocationSchema = z
	.object({
		scope: z.literal("board"),
		position: PositionSchema.describe("The coordinates inside the board."),
	})
	.strict()
	.meta({
		id: "BoardLocationSchema",
		description: "One concrete board location usable as a spatial gameplay origin.",
	});

export type BoardLocationSchema = typeof BoardLocationSchema;

export namespace BoardLocationSchema {
	export type Type = z.infer<BoardLocationSchema>;
}
