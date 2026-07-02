import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import { appendBoardTileBounceFeedback } from "~/v0/play/game-engine-visual/appendBoardTileBounceFeedback";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";

type CompletedEvent = Extract<
	GameEvent,
	{
		type: "line.completed";
	}
>;

export namespace appendLineCompletedFeedback {
	export interface Props {
		event: CompletedEvent;
		plan: GameEngineVisualPlanDraft;
	}
}

export const appendLineCompletedFeedback = ({ event, plan }: appendLineCompletedFeedback.Props) =>
	appendBoardTileBounceFeedback({
		groupId: `engine:producer-completed-feedback:${event.itemInstanceId}:${event.jobId}`,
		plan,
		tileId: event.itemInstanceId,
	});
