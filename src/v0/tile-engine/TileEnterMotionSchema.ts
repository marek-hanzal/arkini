import { z } from "zod";

export const TileEnterMotionSchema = z.object({
	kind: z
		.enum([
			"fade-in",
			"pop-in",
		])
		.optional(),
	delayMs: z.number().nonnegative().optional(),
	durationMs: z.number().nonnegative().optional(),
});

type TileEnterMotionSchema = typeof TileEnterMotionSchema;
export namespace TileEnterMotionSchema {
	export type Type = z.infer<TileEnterMotionSchema>;
}
