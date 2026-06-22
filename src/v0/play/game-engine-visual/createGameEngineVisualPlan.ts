import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { appendItemCreatedVisuals } from "~/v0/play/game-engine-visual/appendItemCreatedVisuals";
import { appendItemMergeVisuals } from "~/v0/play/game-engine-visual/appendItemMergeVisuals";
import { appendItemReplaceVisuals } from "~/v0/play/game-engine-visual/appendItemReplaceVisuals";
import { appendProducerInputStoreVisuals } from "~/v0/play/game-engine-visual/appendProducerInputStoreVisuals";
import { appendProducerInputStoredFeedback } from "~/v0/play/game-engine-visual/appendProducerInputStoredFeedback";
import { appendProducerProductCompletedFeedback } from "~/v0/play/game-engine-visual/appendProducerProductCompletedFeedback";
import type { GameEngineVisualPlan } from "~/v0/play/game-engine-visual/GameEngineVisualPlan";
import { createGameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";
import { findMergeResultEventIndex } from "~/v0/play/game-engine-visual/findMergeResultEventIndex";
import { findProducerInputStoredEventIndex } from "~/v0/play/game-engine-visual/findProducerInputStoredEventIndex";
import { shouldAnimateProducerInputStoreVisual } from "~/v0/play/game-engine-visual/shouldAnimateProducerInputStoreVisual";

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
	let createdSequenceIndex = 0;

	for (const [index, event] of events.entries()) {
		if (skipped.has(index)) continue;

		switch (event.type) {
			case "item.created":
				appendItemCreatedVisuals({
					currentBoard,
					currentInventory,
					event,
					plan,
					sequenceIndex: createdSequenceIndex,
				});
				createdSequenceIndex += 1;
				break;

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
					const storedIndex = findProducerInputStoredEventIndex({
						afterIndex: index,
						events,
						skipped,
						source: event,
					});
					const stored = events[storedIndex];
					if (
						stored?.type === "producer_input.stored" ||
						stored?.type === "craft_input.stored"
					) {
						skipped.add(storedIndex);
						appendProducerInputStoredFeedback({
							plan,
							stored,
						});

						if (
							shouldAnimateProducerInputStoreVisual({
								events,
								stored,
							})
						) {
							appendProducerInputStoreVisuals({
								plan,
								previousBoard,
								source: event,
								stored,
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
				appendProducerInputStoredFeedback({
					plan,
					stored: event,
				});
				break;

			case "product.completed":
				appendProducerProductCompletedFeedback({
					event,
					plan,
				});
				break;

			case "craft.completed":
			case "craft.started":
			case "craft_input.withdrawn":
			case "item.removed":
			case "item.spawn.blocked":
			case "producer.product_line.default_changed":
			case "producer.product_line.enabled_changed":
			case "producer_input.withdrawn":
			case "product.blocked":
			case "product.started":
			case "stash.depleted":
			case "stash.opened":
			case "stored_requirement.stored":
			case "stored_requirement.withdrawn":
			case "upgrade.completed":
			case "upgrade.started":
				plan.ignoredEventTypes.push(event.type);
				break;

			default: {
				const exhaustive: never = event;
				return exhaustive;
			}
		}
	}
	return plan;
};
