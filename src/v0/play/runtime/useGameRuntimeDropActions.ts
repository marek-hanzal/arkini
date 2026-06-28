import { useMemo } from "react";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameAction } from "~/v0/game/action/GameActionSchema";
import type { GameActionItemRef } from "~/v0/game/action/GameActionItemRefSchema";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { createGameActionFromItemToBoardItemInteractionPlan } from "~/v0/play/interaction/createGameActionFromItemToBoardItemInteractionPlan";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";
import { useGameRuntimeStore } from "~/v0/play/runtime/GameRuntimeContext";
import type { GameRuntimeState, GameRuntimeStore } from "~/v0/play/runtime/GameRuntimeStore";
import { readBoardView, readInventoryView } from "~/v0/play/runtime/readers";

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
	expectedSourceItemId,
	expectedTargetItemId,
	resolveSourceItemId,
	sourceRef,
	store,
	targetBoardItemId,
}: {
	expectedSourceItemId: string;
	expectedTargetItemId: string;
	resolveSourceItemId(input: {
		board: BoardView;
		snapshot: GameRuntimeState;
	}): string | undefined;
	sourceRef: GameActionItemRef;
	store: GameRuntimeStore;
	targetBoardItemId: string;
}) => {
	const snapshot = store.getSnapshot();
	const { config } = snapshot.runtime;
	const board = readBoardView(snapshot);
	const sourceItemId = resolveSourceItemId({
		board,
		snapshot,
	});
	const target = board.byId[targetBoardItemId];

	if (
		!sourceItemId ||
		sourceItemId !== expectedSourceItemId ||
		!target ||
		target.itemId !== expectedTargetItemId
	) {
		return Promise.resolve();
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
					expectedSourceItemId: input.expectedSourceItemId,
					expectedTargetItemId: input.expectedTargetItemId,
					resolveSourceItemId: ({ board }) => board.byId[input.sourceBoardItemId]?.itemId,
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
					expectedSourceItemId: input.expectedSourceItemId,
					expectedTargetItemId: input.expectedTargetItemId,
					resolveSourceItemId: ({ snapshot }) => {
						const stack =
							readInventoryView(snapshot).bySlotIndex[String(input.sourceSlotIndex)]
								?.stack;
						if (
							!stack ||
							stack.id !== input.expectedSourceStackId ||
							stack.itemId !== input.expectedSourceItemId
						) {
							return undefined;
						}
						return stack.itemId;
					},
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
				const boardItem = readBoardView(store.getSnapshot()).byId[input.boardItemId];
				if (!boardItem || boardItem.itemId !== input.expectedItemId)
					return Promise.resolve();

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
				const stack = readInventoryView(store.getSnapshot()).bySlotIndex[
					String(input.slotIndex)
				]?.stack;
				if (
					!stack ||
					stack.id !== input.expectedStackId ||
					stack.itemId !== input.expectedItemId
				) {
					return Promise.resolve();
				}

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
				const board = readBoardView(store.getSnapshot());
				const source = board.byId[input.sourceBoardItemId];
				const target = board.byId[input.targetBoardItemId];
				if (
					!source ||
					source.itemId !== input.expectedSourceItemId ||
					!target ||
					target.itemId !== input.expectedTargetItemId
				) {
					return Promise.resolve();
				}

				return store.dispatch({
					action: {
						sourceBoardItemId: input.sourceBoardItemId,
						targetBoardItemId: input.targetBoardItemId,
						type: "board.items.swap",
					},
				});
			},
			swapInventorySlots(input) {
				const inventory = readInventoryView(store.getSnapshot());
				const source = inventory.bySlotIndex[String(input.sourceSlotIndex)]?.stack;
				const target = inventory.bySlotIndex[String(input.targetSlotIndex)]?.stack;
				if (
					!source ||
					source.id !== input.expectedSourceStackId ||
					source.itemId !== input.expectedSourceItemId ||
					target?.id !== input.expectedTargetStackId ||
					target?.itemId !== input.expectedTargetItemId
				) {
					return Promise.resolve();
				}

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
