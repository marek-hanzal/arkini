import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
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

type ActivationInputStoredEvent = Extract<
	GameEvent,
	{
		type: "producer_input.stored" | "craft_input.stored";
	}
>;

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

export const createGameEngineVisualPlan = ({
	currentBoard,
	currentInventory,
	events,
	previousBoard,
}: createGameEngineVisualPlan.Props): GameEngineVisualPlan => {
	const plan = createGameEngineVisualPlanDraft();
	const skipped = new Set<number>();
	const animatedCraftStageTargetIds = new Set<string>();
	const deferredStashDepletionRemovals: Extract<
		GameEvent,
		{
			type: "item.removed";
		}
	>[] = [];
	let createdSequenceIndex = 0;
	let memoryRestoreOriginTileId: string | undefined;
	let memoryRestoreSequenceIndex = 0;
	const boardMemoryItemInstanceId = events.find(
		(event) =>
			event.type === "board.memory.saved" ||
			event.type === "board.memory.restored" ||
			event.type === "board.memory.cleared",
	)?.boardItemId;

	for (const [index, event] of events.entries()) {
		if (skipped.has(index)) continue;

		switch (event.type) {
			case "item.created": {
				if (event.reason === "memory-restore") {
					appendBoardMemoryRestoreVisuals({
						currentBoard,
						event,
						plan,
						restoreOriginTileId: memoryRestoreOriginTileId,
						sequenceIndex: memoryRestoreSequenceIndex,
					});
					memoryRestoreSequenceIndex += 1;
					break;
				}

				const sequenceIndex = event.spawnSequenceIndex ?? createdSequenceIndex;
				appendItemCreatedVisuals({
					currentBoard,
					currentInventory,
					event,
					plan,
					sequenceIndex,
				});
				createdSequenceIndex = Math.max(createdSequenceIndex + 1, sequenceIndex + 1);
				break;
			}

			case "item.consumed": {
				if (event.reason === "memory-store") {
					const transientTileId = appendBoardMemoryStoreVisuals({
						event,
						memoryItemInstanceId: boardMemoryItemInstanceId,
						plan,
						previousBoard,
						sequenceIndex: createdSequenceIndex,
					});
					if (
						event.from.kind === "board" &&
						event.from.itemInstanceId === boardMemoryItemInstanceId
					) {
						memoryRestoreOriginTileId = transientTileId ?? event.from.itemInstanceId;
					}
					createdSequenceIndex += 1;
					break;
				}

				if (event.reason === "merge-source") {
					const replacementIndex = findMergeResultEventIndex({
						afterIndex: index,
						events,
						skipped,
					});
					const replacement = events[replacementIndex];
					if (replacement?.type === "item.replaced") {
						skipped.add(replacementIndex);
						appendItemMergeVisuals({
							currentBoard,
							plan,
							previousBoard,
							replaced: replacement,
							source: event,
						});
						break;
					}
				}

				if (
					event.reason === "producer-input-auto-fill" ||
					event.reason === "craft-input-auto-fill"
				) {
					const targetIndex = findActivationInputTargetEventIndex({
						afterIndex: index,
						events,
						skipped,
						source: event,
					});
					const target = events[targetIndex];
					if (
						target?.type === "producer_input.stored" ||
						target?.type === "craft_input.stored"
					) {
						skipped.add(targetIndex);
						appendActivationInputTargetVisuals({
							animatedCraftStageTargetIds,
							currentBoard,
							plan,
							previousBoard,
							target,
						});

						if (
							shouldAnimateActivationInputStoreVisual({
								target,
							})
						) {
							appendActivationInputStoreVisuals({
								plan,
								previousBoard,
								source: event,
								target,
							});
						}

						break;
					}
				}

				plan.ignoredEventTypes.push(event.type);
				break;
			}

			case "item.replaced":
				appendItemReplaceVisuals({
					currentBoard,
					event,
					plan,
					previousBoard,
				});
				break;

			case "producer_input.stored":
			case "craft_input.stored":
				appendActivationInputTargetVisuals({
					animatedCraftStageTargetIds,
					currentBoard,
					plan,
					previousBoard,
					target: event,
				});
				break;

			case "line.completed":
				appendLineCompletedFeedback({
					event,
					plan,
				});
				break;

			case "item.removed":
				if (event.reason === "producer-depleted") {
					deferredStashDepletionRemovals.push(event);
				} else if (event.reason !== "debug-delete") {
					appendRemovedBoardItemVisuals({
						currentBoard,
						event,
						plan,
						previousBoard,
					});
				}
				plan.ignoredEventTypes.push(event.type);
				break;
			case "craft.completed":
			case "craft.blocked":
			case "craft.failed":
			case "effect.activated":
			case "effect.expired":
			case "craft.started":
			case "craft_input.withdrawn":
			case "item.spawn.blocked":
			case "item.spawn.failed":
			case "line.default_changed":
				plan.ignoredEventTypes.push(event.type);
				break;
			case "board.memory.saved":
				appendBoardTileBounceFeedback({
					durationMs: 520,
					groupId: `engine:memory-saved-feedback:${event.boardItemId}:${event.atMs}`,
					plan,
					tileId: event.boardItemId,
				});
				plan.ignoredEventTypes.push(event.type);
				break;
			case "board.memory.restored":
				appendBoardTileBounceFeedback({
					durationMs: 380,
					groupId: `engine:memory-restored-feedback:${event.boardItemId}:${event.atMs}`,
					plan,
					pulseCount: 2,
					tileId: event.boardItemId,
				});
				plan.ignoredEventTypes.push(event.type);
				break;
			case "board.memory.cleared":
				appendBoardTileBounceFeedback({
					durationMs: 420,
					groupId: `engine:memory-cleared-feedback:${event.boardItemId}:${event.atMs}`,
					plan,
					tileId: event.boardItemId,
				});
				plan.ignoredEventTypes.push(event.type);
				break;
			case "cheat.speed_mode.changed":
			case "item.capacity.changed":
			case "item.capacity.depleted":
			case "producer_input.withdrawn":
			case "line.blocked":
			case "line.failed":
			case "line.started":
				plan.ignoredEventTypes.push(event.type);
				break;

			default: {
				const exhaustive: never = event;
				return exhaustive;
			}
		}
	}

	for (const event of deferredStashDepletionRemovals) {
		appendRemovedBoardItemVisuals({
			currentBoard,
			event,
			plan,
			previousBoard,
		});
	}

	return plan;
};
