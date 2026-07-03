import type { TileEngineMotionRequest } from "~/tile-engine/TileEngineMotionRequest";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";

export namespace createBoardTileBounceFeedbackRequest {
	export interface Props {
		delayMs?: number;
		durationMs?: number;
		groupId: string;
		pulseCount?: number;
		tileId: string;
	}
}

export const createBoardTileBounceFeedbackRequest = ({
	delayMs = 0,
	durationMs = TileEngineTiming.feedbackDurationSeconds * 1000,
	groupId,
	pulseCount = 1,
	tileId,
}: createBoardTileBounceFeedbackRequest.Props): TileEngineMotionRequest => ({
	cleanupDelayMs: delayMs + durationMs * pulseCount + TileEngineTiming.motionCleanupBufferMs,
	feedback: {
		delayMs,
		durationMs,
		groupId,
		kind: "bounce",
		pulseCount,
	},
	tileId,
});
