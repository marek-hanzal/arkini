import { z } from "zod";

export const TileEnterMotionSchema = z.object({
	kind: z
		.enum([
			"fade-in",
			"merge-in",
			"pop-in",
			"spawn-from-tile",
		])
		.optional(),
	delayMs: z.number().nonnegative().optional(),
	durationMs: z.number().nonnegative().optional(),
	sequenceIndex: z.number().int().nonnegative().optional(),
	groupId: z.string().min(1).optional(),
	fromTileId: z.string().min(1).optional(),
});

type TileEnterMotionSchema = typeof TileEnterMotionSchema;
export namespace TileEnterMotionSchema {
	export type Type = z.infer<TileEnterMotionSchema>;
}
