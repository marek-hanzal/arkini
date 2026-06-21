import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";
import { TileEngineTiming } from "~/v0/tile-engine";

export namespace appendBoardTileBounceFeedback {
	export interface Props {
		groupId: string;
		plan: GameEngineVisualPlanDraft;
		tileId: string;
	}
}

export const appendBoardTileBounceFeedback = ({
	groupId,
	plan,
	tileId,
}: appendBoardTileBounceFeedback.Props) => {
	plan.boardFeedbackRequests.push({
		cleanupDelayMs:
			TileEngineTiming.feedbackDurationSeconds * 1000 +
			TileEngineTiming.motionCleanupBufferMs,
		feedback: {
			groupId,
			kind: "bounce",
		},
		tileId,
	});
};
