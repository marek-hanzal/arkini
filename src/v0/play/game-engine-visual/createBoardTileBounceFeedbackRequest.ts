import type { TileEngineMotionRequest } from "~/v0/tile-engine";
import { TileEngineTiming } from "~/v0/tile-engine";

export namespace createBoardTileBounceFeedbackRequest {
	export interface Props {
		groupId: string;
		pulseCount?: number;
		tileId: string;
	}
}

export const createBoardTileBounceFeedbackRequest = ({
	groupId,
	pulseCount = 1,
	tileId,
}: createBoardTileBounceFeedbackRequest.Props): TileEngineMotionRequest => ({
	cleanupDelayMs:
		TileEngineTiming.feedbackDurationSeconds * 1000 * pulseCount +
		TileEngineTiming.motionCleanupBufferMs,
	feedback: {
		groupId,
		kind: "bounce",
		pulseCount,
	},
	tileId,
});
