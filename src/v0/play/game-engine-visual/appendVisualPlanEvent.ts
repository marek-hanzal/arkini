import { match } from "ts-pattern";
import type { GameEvent } from "~/event/GameEventSchema";
import { appendActivationInputStoredEventVisuals } from "~/play/game-engine-visual/appendActivationInputStoredEventVisuals";
import { appendBoardMemoryFeedbackEventVisuals } from "~/play/game-engine-visual/appendBoardMemoryFeedbackEventVisuals";
import { appendItemCapacityChangedEventVisuals } from "~/play/game-engine-visual/appendItemCapacityChangedEventVisuals";
import { appendItemConsumedEventVisuals } from "~/play/game-engine-visual/appendItemConsumedEventVisuals";
import { appendItemCreatedEventVisuals } from "~/play/game-engine-visual/appendItemCreatedEventVisuals";
import { appendItemRemovedEventVisuals } from "~/play/game-engine-visual/appendItemRemovedEventVisuals";
import { appendItemReplaceVisuals } from "~/play/game-engine-visual/appendItemReplaceVisuals";
import { appendLineCompletedFeedback } from "~/play/game-engine-visual/appendLineCompletedFeedback";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";
import { ignoreVisualEvent } from "~/play/game-engine-visual/ignoreVisualEvent";
import { isIgnoredVisualEvent } from "~/play/game-engine-visual/isIgnoredVisualEvent";

export const appendVisualPlanEvent = ({
	context,
	event,
	index,
}: {
	context: GameEngineVisualPlanContext;
	event: GameEvent;
	index: number;
}) => {
	if (isIgnoredVisualEvent(event)) {
		ignoreVisualEvent(context, event);
		return;
	}

	return match(event)
		.with(
			{
				type: "item.created",
			},
			(matchedEvent) => appendItemCreatedEventVisuals(context, matchedEvent),
		)
		.with(
			{
				type: "item.capacity.changed",
			},
			(matchedEvent) => appendItemCapacityChangedEventVisuals(context, matchedEvent),
		)
		.with(
			{
				type: "item.consumed",
			},
			(matchedEvent) =>
				appendItemConsumedEventVisuals({
					context,
					event: matchedEvent,
					index,
				}),
		)
		.with(
			{
				type: "item.replaced",
			},
			(matchedEvent) =>
				appendItemReplaceVisuals({
					currentBoard: context.currentBoard,
					event: matchedEvent,
					plan: context.plan,
					previousBoard: context.previousBoard,
				}),
		)
		.with(
			{
				type: "producer_input.stored",
			},
			(matchedEvent) => appendActivationInputStoredEventVisuals(context, matchedEvent),
		)
		.with(
			{
				type: "craft_input.stored",
			},
			(matchedEvent) => appendActivationInputStoredEventVisuals(context, matchedEvent),
		)
		.with(
			{
				type: "line.completed",
			},
			(matchedEvent) =>
				appendLineCompletedFeedback({
					event: matchedEvent,
					plan: context.plan,
				}),
		)
		.with(
			{
				type: "item.removed",
			},
			(matchedEvent) => appendItemRemovedEventVisuals(context, matchedEvent),
		)
		.with(
			{
				type: "board.memory.saved",
			},
			(matchedEvent) => appendBoardMemoryFeedbackEventVisuals(context, matchedEvent),
		)
		.with(
			{
				type: "board.memory.restored",
			},
			(matchedEvent) => appendBoardMemoryFeedbackEventVisuals(context, matchedEvent),
		)
		.with(
			{
				type: "board.memory.cleared",
			},
			(matchedEvent) => appendBoardMemoryFeedbackEventVisuals(context, matchedEvent),
		)
		.exhaustive();
};
