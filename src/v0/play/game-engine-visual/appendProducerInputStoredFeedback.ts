import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import { appendBoardTileBounceFeedback } from "~/v0/play/game-engine-visual/appendBoardTileBounceFeedback";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";

type StoredEvent = Extract<
	GameEvent,
	{
		type: "producer_input.stored";
	}
>;

export namespace appendProducerInputStoredFeedback {
	export interface Props {
		plan: GameEngineVisualPlanDraft;
		stored: StoredEvent;
	}
}

export const appendProducerInputStoredFeedback = ({
	plan,
	stored,
}: appendProducerInputStoredFeedback.Props) =>
	appendBoardTileBounceFeedback({
		groupId: `engine:producer-input-feedback:${stored.producerItemInstanceId}:${stored.productId}:${stored.itemId}:${stored.storedAtMs}`,
		plan,
		tileId: stored.producerItemInstanceId,
	});
