import { z } from "zod";
import { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";
import { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";

export const TileEngineMotionSchema = z.object({
	enter: TileEnterMotionSchema.optional(),
	exit: TileExitMotionSchema.optional(),
});

type TileEngineMotionSchema = typeof TileEngineMotionSchema;
export namespace TileEngineMotionSchema {
	export type Type = z.infer<TileEngineMotionSchema>;
}
