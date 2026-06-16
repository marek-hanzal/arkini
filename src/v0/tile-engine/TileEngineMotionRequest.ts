import type { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";
import type { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";

export interface TileEngineMotionRequest {
	tileId: string;
	cleanupDelayMs?: number;
	enter?: TileEnterMotionSchema.Type;
	exit?: TileExitMotionSchema.Type;
}
