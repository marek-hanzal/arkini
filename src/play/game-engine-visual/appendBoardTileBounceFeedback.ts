import { createBoardTileBounceFeedbackRequest } from "~/play/game-engine-visual/createBoardTileBounceFeedbackRequest";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";

export namespace appendBoardTileBounceFeedback {
	export interface Props {
		delayMs?: number;
		durationMs?: number;
		groupId: string;
		plan: GameEngineVisualPlanDraft;
		pulseCount?: number;
		tileId: string;
	}
}

export const appendBoardTileBounceFeedback = ({
	delayMs,
	durationMs,
	groupId,
	plan,
	pulseCount,
	tileId,
}: appendBoardTileBounceFeedback.Props) => {
	plan.boardFeedbackRequests.push(
		createBoardTileBounceFeedbackRequest({
			delayMs,
			durationMs,
			groupId,
			pulseCount,
			tileId,
		}),
	);
};
