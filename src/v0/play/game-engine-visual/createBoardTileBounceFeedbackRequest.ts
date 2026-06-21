import type { TileEngineMotionRequest } from "~/v0/tile-engine";
import { TileEngineTiming } from "~/v0/tile-engine";

export namespace createBoardTileBounceFeedbackRequest {
	export interface Props {
		groupId: string;
		tileId: string;
	}
}

export const createBoardTileBounceFeedbackRequest = ({
	groupId,
	tileId,
}: createBoardTileBounceFeedbackRequest.Props): TileEngineMotionRequest => ({
	cleanupDelayMs:
		TileEngineTiming.feedbackDurationSeconds * 1000 + TileEngineTiming.motionCleanupBufferMs,
	feedback: {
		groupId,
		kind: "bounce",
	},
	tileId,
});
