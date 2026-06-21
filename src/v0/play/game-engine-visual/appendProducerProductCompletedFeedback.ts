import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import { appendBoardTileBounceFeedback } from "~/v0/play/game-engine-visual/appendBoardTileBounceFeedback";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";

type CompletedEvent = Extract<
	GameEvent,
	{
		type: "product.completed";
	}
>;

export namespace appendProducerProductCompletedFeedback {
	export interface Props {
		event: CompletedEvent;
		plan: GameEngineVisualPlanDraft;
	}
}

export const appendProducerProductCompletedFeedback = ({
	event,
	plan,
}: appendProducerProductCompletedFeedback.Props) =>
	appendBoardTileBounceFeedback({
		groupId: `engine:producer-completed-feedback:${event.producerItemInstanceId}:${event.jobId}`,
		plan,
		tileId: event.producerItemInstanceId,
	});
