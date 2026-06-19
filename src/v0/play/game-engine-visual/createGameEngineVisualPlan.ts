import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { appendItemCreatedVisuals } from "~/v0/play/game-engine-visual/appendItemCreatedVisuals";
import { appendItemMergeVisuals } from "~/v0/play/game-engine-visual/appendItemMergeVisuals";
import { appendItemReplaceVisuals } from "~/v0/play/game-engine-visual/appendItemReplaceVisuals";
import type { GameEngineVisualPlan } from "~/v0/play/game-engine-visual/GameEngineVisualPlan";
import { createGameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";
import { findMergeResultEventIndex } from "~/v0/play/game-engine-visual/findMergeResultEventIndex";

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

			case "craft.completed":
			case "craft.started":
			case "craft_input.stored":
			case "craft_input.withdrawn":
			case "item.removed":
			case "item.spawn.blocked":
			case "producer.product_line.enabled_changed":
			case "producer_input.stored":
			case "producer_input.withdrawn":
			case "product.blocked":
			case "product.completed":
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
