import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";

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
		cleanupDelayMs: 420,
		feedback: {
			groupId,
			kind: "bounce",
		},
		tileId,
	});
};
