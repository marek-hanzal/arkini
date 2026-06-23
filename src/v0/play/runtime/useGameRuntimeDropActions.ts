import { useMemo } from "react";
import type { GameAction } from "~/v0/game/action/GameActionSchema";
import type { GameActionItemRef } from "~/v0/game/action/GameActionItemRefSchema";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { createGameActionFromItemToBoardItemInteractionPlan } from "~/v0/play/interaction/createGameActionFromItemToBoardItemInteractionPlan";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";
import { useGameRuntimeStore } from "~/v0/play/runtime/GameRuntimeContext";
import type { GameRuntimeStore } from "~/v0/play/runtime/GameRuntimeStore";
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

const dispatchItemToBoardItemAction = ({
	resolveSourceItemId,
	sourceRef,
	store,
	targetBoardItemId,
}: {
	resolveSourceItemId(): string | undefined;
	sourceRef: GameActionItemRef;
	store: GameRuntimeStore;
	targetBoardItemId: string;
}) => {
	const snapshot = store.getSnapshot();
	const { config } = snapshot.runtime;
	const sourceItemId = resolveSourceItemId();
	const target = readBoardView(snapshot).byId[targetBoardItemId];

	if (!sourceItemId || !target) {
		return store.dispatch({
			action: createFallbackMergeAction({
				sourceRef,
				targetItemInstanceId: targetBoardItemId,
			}),
		});
	}

	const action = createGameActionFromItemToBoardItemInteractionPlan({
		plan: resolveItemToBoardItemInteractionPlan({
			config,
			sourceItemId,
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
};

export const useGameRuntimeDropActions = (): DropActions => {
	const store = useGameRuntimeStore();

	return useMemo(
		() => ({
			applyBoardItemToBoardItem(input) {
				return dispatchItemToBoardItemAction({
					resolveSourceItemId: () =>
						store.getSnapshot().runtime.save.board.items[input.sourceBoardItemId]
							?.itemId,
					sourceRef: {
						kind: "board",
						itemInstanceId: input.sourceBoardItemId,
					},
					store,
					targetBoardItemId: input.targetBoardItemId,
				});
			},
			applyInventoryItemToBoardItem(input) {
				return dispatchItemToBoardItemAction({
					resolveSourceItemId: () =>
						store.getSnapshot().runtime.save.inventory.slots[input.sourceSlotIndex]
							?.itemId,
					sourceRef: {
						kind: "inventory",
						quantity: 1,
						slotIndex: input.sourceSlotIndex,
					},
					store,
					targetBoardItemId: input.targetBoardItemId,
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
