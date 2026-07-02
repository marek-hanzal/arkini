import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import { appendBoardTileBounceFeedback } from "~/v0/play/game-engine-visual/appendBoardTileBounceFeedback";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";

type CompletedEvent = Extract<
	GameEvent,
	{
		type: "producer_line.completed";
	}
>;

export namespace appendProducerLineCompletedFeedback {
	export interface Props {
		event: CompletedEvent;
		plan: GameEngineVisualPlanDraft;
	}
}

export const appendProducerLineCompletedFeedback = ({
	event,
	plan,
}: appendProducerLineCompletedFeedback.Props) =>
	appendBoardTileBounceFeedback({
		groupId: `engine:producer-completed-feedback:${event.producerItemInstanceId}:${event.jobId}`,
		plan,
		tileId: event.producerItemInstanceId,
	});
