import type { TileEnterMotionSchema } from "~/tile-engine/TileEnterMotionSchema";
import type { TileExitMotionSchema } from "~/tile-engine/TileExitMotionSchema";
import type { TileFeedbackMotionSchema } from "~/tile-engine/TileFeedbackMotionSchema";

export interface TileEngineMotionRequest {
	tileId: string;
	cleanupDelayMs?: number;
	enter?: TileEnterMotionSchema.Type;
	exit?: TileExitMotionSchema.Type;
	feedback?: TileFeedbackMotionSchema.Type;
}
