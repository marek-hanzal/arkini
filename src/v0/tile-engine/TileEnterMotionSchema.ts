import { z } from "zod";

export const TileEnterMotionSchema = z.object({
	delayMs: z.number().nonnegative().optional(),
});

type TileEnterMotionSchema = typeof TileEnterMotionSchema;
export namespace TileEnterMotionSchema {
	export type Type = z.infer<TileEnterMotionSchema>;
}
