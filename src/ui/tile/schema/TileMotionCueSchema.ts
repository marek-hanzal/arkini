import { z } from "zod";

/** One bounded presentation cue owned by an exact runtime tile actor generation. */
export const TileMotionCueSchema = z
	.object({
		generation: z.number().int().positive(),
		kind: z.enum(["spawn", "settle", "impact", "accept", "exit"]),
		strength: z.number().int().min(1).max(3),
	})
	.strict();

export type TileMotionCueSchema = typeof TileMotionCueSchema;

export namespace TileMotionCueSchema {
	export type Type = z.infer<TileMotionCueSchema>;
}
