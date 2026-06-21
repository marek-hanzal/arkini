import { z } from "zod";
import { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";
import { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";
import { TileFeedbackMotionSchema } from "~/v0/tile-engine/TileFeedbackMotionSchema";

export const TileEngineMotionSchema = z.object({
	enter: TileEnterMotionSchema.optional(),
	exit: TileExitMotionSchema.optional(),
	feedback: TileFeedbackMotionSchema.optional(),
});

type TileEngineMotionSchema = typeof TileEngineMotionSchema;
export namespace TileEngineMotionSchema {
	export type Type = z.infer<TileEngineMotionSchema>;
}
