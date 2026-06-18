import { z } from "zod";

export const TileExitMotionSchema = z.object({
	kind: z
		.enum([
			"merge-out",
			"replace-out",
		])
		.optional(),
	delayMs: z.number().nonnegative().optional(),
	durationMs: z.number().nonnegative().optional(),
	groupId: z.string().min(1).optional(),
});

type TileExitMotionSchema = typeof TileExitMotionSchema;
export namespace TileExitMotionSchema {
	export type Type = z.infer<TileExitMotionSchema>;
}
