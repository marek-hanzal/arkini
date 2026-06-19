import { useMemo } from "react";
import type { GameAction } from "~/v0/game/action/GameActionSchema";
import type { GameActionItemRef } from "~/v0/game/action/GameActionItemRefSchema";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { createGameActionFromItemToBoardItemInteractionPlan } from "~/v0/play/interaction/createGameActionFromItemToBoardItemInteractionPlan";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";
import { useGameRuntimeStore } from "~/v0/play/runtime/GameRuntimeContext";
import { readBoardView } from "~/v0/play/runtime/readers/readBoardView";

const createFallbackMergeAction = ({
	sourceRef,
	targetItemInstanceId,
}: {
	sourceRef: GameActionItemRef;
	targetItemInstanceId: string;
}): GameAction => ({
	sourceRef,
	targetItemInstanceId,
	type: "item.merge",
});

export const useGameRuntimeDropActions = (): DropActions => {
	const store = useGameRuntimeStore();

	return useMemo(
		() => ({
			applyBoardItemToBoardItem(input) {
				const snapshot = store.getSnapshot();
				const { config, save } = snapshot.runtime;
				const source = save.board.items[input.sourceBoardItemId];
				const target = readBoardView(snapshot).byId[input.targetBoardItemId];
				const sourceRef = {
					kind: "board" as const,
					itemInstanceId: input.sourceBoardItemId,
				};

				if (!source || !target) {
					return store.dispatch({
						action: createFallbackMergeAction({
							sourceRef,
							targetItemInstanceId: input.targetBoardItemId,
						}),
					});
				}

				const action = createGameActionFromItemToBoardItemInteractionPlan({
					plan: resolveItemToBoardItemInteractionPlan({
						config,
						sourceItemId: source.itemId,
						targetItem: target,
					}),
					sourceRef,
					targetItemInstanceId: target.id,
				});

				return store.dispatch({
					action:
						action ??
						createFallbackMergeAction({
							sourceRef,
							targetItemInstanceId: target.id,
						}),
				});
			},
			applyInventoryItemToBoardItem(input) {
				const snapshot = store.getSnapshot();
				const { config, save } = snapshot.runtime;
				const source = save.inventory.slots[input.sourceSlotIndex];
				const target = readBoardView(snapshot).byId[input.targetBoardItemId];
				const sourceRef = {
					kind: "inventory" as const,
					quantity: 1,
					slotIndex: input.sourceSlotIndex,
				};

				if (!source || !target) {
					return store.dispatch({
						action: createFallbackMergeAction({
							sourceRef,
							targetItemInstanceId: input.targetBoardItemId,
						}),
					});
				}

				const action = createGameActionFromItemToBoardItemInteractionPlan({
					plan: resolveItemToBoardItemInteractionPlan({
						config,
						sourceItemId: source.itemId,
						targetItem: target,
					}),
					sourceRef,
					targetItemInstanceId: target.id,
				});

				return store.dispatch({
					action:
						action ??
						createFallbackMergeAction({
							sourceRef,
							targetItemInstanceId: target.id,
						}),
				});
			},
			moveBoardItem(input) {
				return store.dispatch({
					action: {
						boardItemId: input.boardItemId,
						type: "board.item.move",
						x: input.x,
						y: input.y,
					},
				});
			},
			placeInventoryItem(input) {
				return store.dispatch({
					action: {
						placementMode: input.placementMode,
						quantity: input.quantity,
						slotIndex: input.slotIndex,
						type: "inventory.item.place",
						x: input.x,
						y: input.y,
					},
				});
			},
			swapBoardItems(input) {
				return store.dispatch({
					action: {
						sourceBoardItemId: input.sourceBoardItemId,
						targetBoardItemId: input.targetBoardItemId,
						type: "board.items.swap",
					},
				});
			},
			swapInventorySlots(input) {
				return store.dispatch({
					action: {
						sourceSlotIndex: input.sourceSlotIndex,
						targetSlotIndex: input.targetSlotIndex,
						type: "inventory.slots.swap",
					},
				});
			},
		}),
		[
			store,
		],
	);
};
