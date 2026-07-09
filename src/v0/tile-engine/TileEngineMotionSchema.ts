import { z } from "zod";
import { TileEnterMotionSchema } from "~/tile-engine/TileEnterMotionSchema";
import { TileExitMotionSchema } from "~/tile-engine/TileExitMotionSchema";
import { TileFeedbackMotionSchema } from "~/tile-engine/TileFeedbackMotionSchema";

export const TileEngineMotionSchema = z.object({
	enter: TileEnterMotionSchema.optional(),
	exit: TileExitMotionSchema.optional(),
	feedback: TileFeedbackMotionSchema.optional(),
});

type TileEngineMotionSchema = typeof TileEngineMotionSchema;
export namespace TileEngineMotionSchema {
	export type Type = z.infer<TileEngineMotionSchema>;
}
