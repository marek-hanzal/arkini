import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { appendItemCreatedVisuals } from "~/v0/play/game-engine-visual/appendItemCreatedVisuals";
import { appendItemMergeVisuals } from "~/v0/play/game-engine-visual/appendItemMergeVisuals";
import { appendItemReplaceVisuals } from "~/v0/play/game-engine-visual/appendItemReplaceVisuals";
import { appendActivationInputStoreVisuals } from "~/v0/play/game-engine-visual/appendActivationInputStoreVisuals";
import { appendActivationInputTargetFeedback } from "~/v0/play/game-engine-visual/appendActivationInputTargetFeedback";
import { appendProducerProductCompletedFeedback } from "~/v0/play/game-engine-visual/appendProducerProductCompletedFeedback";
import { appendStashDepletedRetainedTile } from "~/v0/play/game-engine-visual/appendStashDepletedRetainedTile";
import type { GameEngineVisualPlan } from "~/v0/play/game-engine-visual/GameEngineVisualPlan";
import { createGameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";
import { findMergeResultEventIndex } from "~/v0/play/game-engine-visual/findMergeResultEventIndex";
import { findActivationInputTargetEventIndex } from "~/v0/play/game-engine-visual/findActivationInputTargetEventIndex";
import { shouldAnimateActivationInputStoreVisual } from "~/v0/play/game-engine-visual/shouldAnimateActivationInputStoreVisual";

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
	const deferredStashDepletionRemovals: Extract<
		GameEvent,
		{
			type: "item.removed";
		}
	>[] = [];
	let createdSequenceIndex = 0;

	for (const [index, event] of events.entries()) {
		if (skipped.has(index)) continue;

		switch (event.type) {
			case "item.created": {
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
						appendActivationInputTargetFeedback({
							plan,
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
				appendActivationInputTargetFeedback({
					plan,
					target: event,
				});
				break;

			case "product.completed":
				appendProducerProductCompletedFeedback({
					event,
					plan,
				});
				break;

			case "item.removed":
				if (event.reason === "stash-depleted") {
					deferredStashDepletionRemovals.push(event);
				} else {
					appendStashDepletedRetainedTile({
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
			case "producer.product_line.default_changed":
			case "producer_input.withdrawn":
			case "product.blocked":
			case "product.failed":
			case "product.started":
			case "stored_requirement.stored":
			case "stored_requirement.withdrawn":
				plan.ignoredEventTypes.push(event.type);
				break;

			default: {
				const exhaustive: never = event;
				return exhaustive;
			}
		}
	}

	for (const event of deferredStashDepletionRemovals) {
		appendStashDepletedRetainedTile({
			currentBoard,
			event,
			plan,
			previousBoard,
		});
	}

	return plan;
};
