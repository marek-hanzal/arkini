import { match } from "ts-pattern";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameEventOfType } from "~/event/GameEventOfType";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { appendItemCreatedVisuals } from "~/play/game-engine-visual/appendItemCreatedVisuals";
import { appendItemMergeVisuals } from "~/play/game-engine-visual/appendItemMergeVisuals";
import { appendItemReplaceVisuals } from "~/play/game-engine-visual/appendItemReplaceVisuals";
import { appendActivationInputStoreVisuals } from "~/play/game-engine-visual/appendActivationInputStoreVisuals";
import { appendBoardMemoryStoreVisuals } from "~/play/game-engine-visual/appendBoardMemoryStoreVisuals";
import { appendBoardMemoryRestoreVisuals } from "~/play/game-engine-visual/appendBoardMemoryRestoreVisuals";
import { appendBoardTileBounceFeedback } from "~/play/game-engine-visual/appendBoardTileBounceFeedback";
import { appendActivationInputTargetFeedback } from "~/play/game-engine-visual/appendActivationInputTargetFeedback";
import { appendCraftStageUpdateVisuals } from "~/play/game-engine-visual/appendCraftStageUpdateVisuals";
import { appendLineCompletedFeedback } from "~/play/game-engine-visual/appendLineCompletedFeedback";
import { appendRemovedBoardItemVisuals } from "~/play/game-engine-visual/appendRemovedBoardItemVisuals";
import type { GameEngineVisualPlan } from "~/play/game-engine-visual/GameEngineVisualPlan";
import {
	createGameEngineVisualPlanDraft,
	type GameEngineVisualPlanDraft,
} from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { findMergeResultEventIndex } from "~/play/game-engine-visual/findMergeResultEventIndex";
import { findActivationInputTargetEventIndex } from "~/play/game-engine-visual/findActivationInputTargetEventIndex";
import { shouldAnimateActivationInputStoreVisual } from "~/play/game-engine-visual/shouldAnimateActivationInputStoreVisual";

type ActivationInputStoredEvent = GameEventOfType<"producer_input.stored" | "craft_input.stored">;

type BoardMemoryEvent = GameEventOfType<
	"board.memory.saved" | "board.memory.restored" | "board.memory.cleared"
>;

type VisualPlanContext = createGameEngineVisualPlan.Props & {
	animatedCraftStageTargetIds: Set<string>;
	boardMemoryItemInstanceId?: string;
	createdSequenceIndex: number;
	deferredStashDepletionRemovals: GameEventOfType<"item.removed">[];
	memoryRestoreOriginTileId?: string;
	memoryRestoreSequenceIndex: number;
	plan: GameEngineVisualPlanDraft;
	skipped: Set<number>;
};

const ignoredEventTypeValues = [
	"craft.completed",
	"craft.blocked",
	"craft.failed",
	"effect.activated",
	"effect.expired",
	"craft.started",
	"craft_input.withdrawn",
	"item.spawn.blocked",
	"item.spawn.failed",
	"line.default_changed",
	"cheat.speed_mode.changed",
	"item.capacity.changed",
	"item.capacity.depleted",
	"producer_input.withdrawn",
	"line.blocked",
	"line.failed",
	"line.started",
] as const satisfies readonly GameEvent["type"][];

type IgnoredVisualEventType = (typeof ignoredEventTypeValues)[number];
type IgnoredVisualEvent = Extract<
	GameEvent,
	{
		type: IgnoredVisualEventType;
	}
>;
const ignoredEventTypes = new Set<GameEvent["type"]>(ignoredEventTypeValues);

const isIgnoredVisualEvent = (event: GameEvent): event is IgnoredVisualEvent =>
	ignoredEventTypes.has(event.type);

const readBoardMemoryItemInstanceId = (events: readonly GameEvent[]) =>
	events.find(
		(event) =>
			event.type === "board.memory.saved" ||
			event.type === "board.memory.restored" ||
			event.type === "board.memory.cleared",
	)?.boardItemId;

const createVisualPlanContext = (props: createGameEngineVisualPlan.Props): VisualPlanContext => ({
	...props,
	animatedCraftStageTargetIds: new Set<string>(),
	boardMemoryItemInstanceId: readBoardMemoryItemInstanceId(props.events),
	createdSequenceIndex: 0,
	deferredStashDepletionRemovals: [],
	memoryRestoreSequenceIndex: 0,
	plan: createGameEngineVisualPlanDraft(),
	skipped: new Set<number>(),
});

const ignoreVisualEvent = ({ plan }: VisualPlanContext, event: GameEvent) => {
	plan.ignoredEventTypes.push(event.type);
};

const appendActivationInputTargetVisuals = ({
	animatedCraftStageTargetIds,
	currentBoard,
	plan,
	previousBoard,
	target,
}: {
	animatedCraftStageTargetIds: Set<string>;
	currentBoard: BoardView | undefined;
	plan: GameEngineVisualPlanDraft;
	previousBoard: BoardView | undefined;
	target: ActivationInputStoredEvent;
}) => {
	if (target.type === "craft_input.stored") {
		if (animatedCraftStageTargetIds.has(target.targetItemInstanceId)) return;

		animatedCraftStageTargetIds.add(target.targetItemInstanceId);
		appendCraftStageUpdateVisuals({
			currentBoard,
			plan,
			previousBoard,
			target,
		});
		return;
	}

	appendActivationInputTargetFeedback({
		plan,
		target,
	});
};

export namespace createGameEngineVisualPlan {
	export interface Props {
		currentBoard: BoardView | undefined;
		currentInventory: InventoryView | undefined;
		events: readonly GameEvent[];
		previousBoard: BoardView | undefined;
	}
}

const appendItemCreatedEventVisuals = (
	context: VisualPlanContext,
	event: GameEventOfType<"item.created">,
) => {
	if (event.reason === "memory-restore") {
		appendBoardMemoryRestoreVisuals({
			currentBoard: context.currentBoard,
			event,
			plan: context.plan,
			restoreOriginTileId: context.memoryRestoreOriginTileId,
			sequenceIndex: context.memoryRestoreSequenceIndex,
		});
		context.memoryRestoreSequenceIndex += 1;
		return;
	}

	const sequenceIndex = event.spawnSequenceIndex ?? context.createdSequenceIndex;
	appendItemCreatedVisuals({
		currentBoard: context.currentBoard,
		currentInventory: context.currentInventory,
		event,
		plan: context.plan,
		sequenceIndex,
	});
	context.createdSequenceIndex = Math.max(context.createdSequenceIndex + 1, sequenceIndex + 1);
};

const appendBoardMemoryStoreEventVisuals = (
	context: VisualPlanContext,
	event: GameEventOfType<"item.consumed">,
) => {
	const transientTileId = appendBoardMemoryStoreVisuals({
		event,
		memoryItemInstanceId: context.boardMemoryItemInstanceId,
		plan: context.plan,
		previousBoard: context.previousBoard,
		sequenceIndex: context.createdSequenceIndex,
	});
	if (
		event.from.kind === "board" &&
		event.from.itemInstanceId === context.boardMemoryItemInstanceId
	) {
		context.memoryRestoreOriginTileId = transientTileId ?? event.from.itemInstanceId;
	}
	context.createdSequenceIndex += 1;
};

const appendMergeSourceEventVisuals = ({
	context,
	event,
	index,
}: {
	context: VisualPlanContext;
	event: GameEventOfType<"item.consumed">;
	index: number;
}) => {
	const replacementIndex = findMergeResultEventIndex({
		afterIndex: index,
		events: context.events,
		skipped: context.skipped,
	});
	const replacement = context.events[replacementIndex];
	if (replacement?.type !== "item.replaced") return false;

	context.skipped.add(replacementIndex);
	appendItemMergeVisuals({
		currentBoard: context.currentBoard,
		plan: context.plan,
		previousBoard: context.previousBoard,
		replaced: replacement,
		source: event,
	});
	return true;
};

const appendActivationInputAutoFillEventVisuals = ({
	context,
	event,
	index,
}: {
	context: VisualPlanContext;
	event: GameEventOfType<"item.consumed">;
	index: number;
}) => {
	const targetIndex = findActivationInputTargetEventIndex({
		afterIndex: index,
		events: context.events,
		skipped: context.skipped,
		source: event,
	});
	const target = context.events[targetIndex];
	if (target?.type !== "producer_input.stored" && target?.type !== "craft_input.stored") {
		return false;
	}

	context.skipped.add(targetIndex);
	appendActivationInputTargetVisuals({
		animatedCraftStageTargetIds: context.animatedCraftStageTargetIds,
		currentBoard: context.currentBoard,
		plan: context.plan,
		previousBoard: context.previousBoard,
		target,
	});

	if (
		shouldAnimateActivationInputStoreVisual({
			target,
		})
	) {
		appendActivationInputStoreVisuals({
			plan: context.plan,
			previousBoard: context.previousBoard,
			source: event,
			target,
		});
	}

	return true;
};

const appendItemConsumedEventVisuals = ({
	context,
	event,
	index,
}: {
	context: VisualPlanContext;
	event: GameEventOfType<"item.consumed">;
	index: number;
}) => {
	const handled = match(event.reason)
		.with("memory-store", () => {
			appendBoardMemoryStoreEventVisuals(context, event);
			return true;
		})
		.with("merge-source", () =>
			appendMergeSourceEventVisuals({
				context,
				event,
				index,
			}),
		)
		.with("producer-input-auto-fill", "craft-input-auto-fill", () =>
			appendActivationInputAutoFillEventVisuals({
				context,
				event,
				index,
			}),
		)
		.with(
			"line-input",
			"producer-input-store",
			"craft-input",
			"craft-input-store",
			"inventory-placement",
			"board-stash",
			"remove-tool",
			"memory-restore",
			() => false,
		)
		.exhaustive();
	if (!handled) ignoreVisualEvent(context, event);
};

const appendActivationInputStoredEventVisuals = (
	context: VisualPlanContext,
	event: ActivationInputStoredEvent,
) =>
	appendActivationInputTargetVisuals({
		animatedCraftStageTargetIds: context.animatedCraftStageTargetIds,
		currentBoard: context.currentBoard,
		plan: context.plan,
		previousBoard: context.previousBoard,
		target: event,
	});

const appendItemRemovedEventVisuals = (
	context: VisualPlanContext,
	event: GameEventOfType<"item.removed">,
) => {
	if (event.reason === "producer-depleted") {
		context.deferredStashDepletionRemovals.push(event);
	} else if (event.reason !== "debug-delete") {
		appendRemovedBoardItemVisuals({
			currentBoard: context.currentBoard,
			event,
			plan: context.plan,
			previousBoard: context.previousBoard,
		});
	}
	ignoreVisualEvent(context, event);
};

const appendBoardMemoryFeedbackEventVisuals = (
	context: VisualPlanContext,
	event: BoardMemoryEvent,
) => {
	const feedback = match(event.type)
		.with("board.memory.saved", () => ({
			durationMs: 520,
			groupId: `engine:memory-saved-feedback:${event.boardItemId}:${event.atMs}`,
			pulseCount: undefined,
		}))
		.with("board.memory.restored", () => ({
			durationMs: 380,
			groupId: `engine:memory-restored-feedback:${event.boardItemId}:${event.atMs}`,
			pulseCount: 2,
		}))
		.with("board.memory.cleared", () => ({
			durationMs: 420,
			groupId: `engine:memory-cleared-feedback:${event.boardItemId}:${event.atMs}`,
			pulseCount: undefined,
		}))
		.exhaustive();

	appendBoardTileBounceFeedback({
		durationMs: feedback.durationMs,
		groupId: feedback.groupId,
		plan: context.plan,
		pulseCount: feedback.pulseCount,
		tileId: event.boardItemId,
	});
	ignoreVisualEvent(context, event);
};

const appendVisualPlanEvent = ({
	context,
	event,
	index,
}: {
	context: VisualPlanContext;
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

const appendDeferredVisualPlanEvents = (context: VisualPlanContext) => {
	for (const event of context.deferredStashDepletionRemovals) {
		appendRemovedBoardItemVisuals({
			currentBoard: context.currentBoard,
			event,
			plan: context.plan,
			previousBoard: context.previousBoard,
		});
	}
};

export const createGameEngineVisualPlan = (
	props: createGameEngineVisualPlan.Props,
): GameEngineVisualPlan => {
	const context = createVisualPlanContext(props);

	for (const [index, event] of props.events.entries()) {
		if (context.skipped.has(index)) continue;
		appendVisualPlanEvent({
			context,
			event,
			index,
		});
	}

	appendDeferredVisualPlanEvents(context);
	return context.plan;
};
