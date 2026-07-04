import { useMemo } from "react";
import type { GameAction } from "~/action/GameActionSchema";
import type { GameActionItemRef } from "~/action/GameActionItemRefSchema";
import type { BoardView } from "~/board/view/BoardViewSchema";
import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
import type { DropActions } from "~/play/drop/DropActions";
import { createGameActionFromItemToBoardItemInteractionPlan } from "~/play/interaction/createGameActionFromItemToBoardItemInteractionPlan";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import type { GameRuntimeState, GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";
import { readExpectedInventorySlotStack } from "~/inventory/view/readExpectedInventorySlotStack";

type RuntimeDropActionContext = {
	board: BoardView;
	nowMs: number;
	snapshot: GameRuntimeState;
	store: GameRuntimeStore;
};

type ItemToBoardItemActionSource = {
	readExpectedSourceItemId(context: RuntimeDropActionContext): string | undefined;
	sourceRef: GameActionItemRef;
};

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

const readRuntimeDropActionContext = ({
	store,
}: {
	store: GameRuntimeStore;
}): RuntimeDropActionContext => {
	const snapshot = store.getSnapshot();
	const nowMs = Date.now();
	return {
		board: readBoardView(snapshot, nowMs),
		nowMs,
		snapshot,
		store,
	};
};

const dispatchRuntimeDropAction = ({
	action,
	context,
}: {
	action: GameAction;
	context: RuntimeDropActionContext;
}) =>
	context.store.dispatch({
		action,
		nowMs: context.nowMs,
	});

const dispatchBoardItemActionWhenExpected = ({
	boardItemId,
	context,
	expectedItemId,
	readAction,
}: {
	boardItemId: string;
	context: RuntimeDropActionContext;
	expectedItemId: string;
	readAction(): GameAction;
}) => {
	const boardItem = readExpectedBoardViewItem({
		board: context.board,
		expectedItemId,
		itemInstanceId: boardItemId,
	});
	if (!boardItem) return Promise.resolve();

	return dispatchRuntimeDropAction({
		action: readAction(),
		context,
	});
};

const dispatchItemToBoardItemAction = ({
	context,
	expectedSourceItemId,
	expectedTargetItemId,
	source,
	targetBoardItemId,
}: {
	context: RuntimeDropActionContext;
	expectedSourceItemId: string;
	expectedTargetItemId: string;
	source: ItemToBoardItemActionSource;
	targetBoardItemId: string;
}) => {
	const { config } = context.snapshot.runtime;
	const sourceItemId = source.readExpectedSourceItemId(context);
	const target = readExpectedBoardViewItem({
		board: context.board,
		expectedItemId: expectedTargetItemId,
		itemInstanceId: targetBoardItemId,
	});

	if (!sourceItemId || sourceItemId !== expectedSourceItemId || !target) {
		return Promise.resolve();
	}

	const action = createGameActionFromItemToBoardItemInteractionPlan({
		plan: resolveItemToBoardItemInteractionPlan({
			config,
			sourceItemId,
			targetItem: target,
		}),
		sourceRef: source.sourceRef,
		targetItemInstanceId: target.id,
	});

	return dispatchRuntimeDropAction({
		action:
			action ??
			createFallbackMergeAction({
				sourceRef: source.sourceRef,
				targetItemInstanceId: target.id,
			}),
		context,
	});
};

const deleteExpectedBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["deleteBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const context = readRuntimeDropActionContext({
		store,
	});
	return dispatchBoardItemActionWhenExpected({
		boardItemId: input.boardItemId,
		context,
		expectedItemId: input.expectedItemId,
		readAction: () => ({
			boardItemId: input.boardItemId,
			expectedItemId: input.expectedItemId,
			type: "debug.board_item.delete",
		}),
	});
};

const applyExpectedBoardItemToBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["applyBoardItemToBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const context = readRuntimeDropActionContext({
		store,
	});
	return dispatchItemToBoardItemAction({
		context,
		expectedSourceItemId: input.expectedSourceItemId,
		expectedTargetItemId: input.expectedTargetItemId,
		source: {
			readExpectedSourceItemId: ({ board }) => board.byId[input.sourceBoardItemId]?.itemId,
			sourceRef: {
				kind: "board",
				itemInstanceId: input.sourceBoardItemId,
			},
		},
		targetBoardItemId: input.targetBoardItemId,
	});
};

const applyExpectedInventoryItemToBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["applyInventoryItemToBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const context = readRuntimeDropActionContext({
		store,
	});
	return dispatchItemToBoardItemAction({
		context,
		expectedSourceItemId: input.expectedSourceItemId,
		expectedTargetItemId: input.expectedTargetItemId,
		source: {
			readExpectedSourceItemId: ({ snapshot }) =>
				readExpectedInventorySlotStack({
					expectedItemId: input.expectedSourceItemId,
					expectedStackId: input.expectedSourceStackId,
					inventory: readInventoryView(snapshot),
					slotIndex: input.sourceSlotIndex,
				})?.itemId,
			sourceRef: {
				kind: "inventory",
				quantity: 1,
				slotIndex: input.sourceSlotIndex,
			},
		},
		targetBoardItemId: input.targetBoardItemId,
	});
};

const moveExpectedBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["moveBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const context = readRuntimeDropActionContext({
		store,
	});
	return dispatchBoardItemActionWhenExpected({
		boardItemId: input.boardItemId,
		context,
		expectedItemId: input.expectedItemId,
		readAction: () => ({
			boardItemId: input.boardItemId,
			type: "board.item.move",
			x: input.x,
			y: input.y,
		}),
	});
};

const storeExpectedBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["storeBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const context = readRuntimeDropActionContext({
		store,
	});
	return dispatchBoardItemActionWhenExpected({
		boardItemId: input.boardItemId,
		context,
		expectedItemId: input.expectedItemId,
		readAction: () => ({
			boardItemId: input.boardItemId,
			type: "board.item.stash",
		}),
	});
};

const placeExpectedInventoryItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["placeInventoryItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const context = readRuntimeDropActionContext({
		store,
	});
	const stack = readExpectedInventorySlotStack({
		expectedItemId: input.expectedItemId,
		expectedStackId: input.expectedStackId,
		inventory: readInventoryView(context.snapshot),
		slotIndex: input.slotIndex,
	});
	if (!stack) return Promise.resolve();

	return dispatchRuntimeDropAction({
		action: {
			placementMode: input.placementMode,
			quantity: input.quantity,
			slotIndex: input.slotIndex,
			type: "inventory.item.place",
			x: input.x,
			y: input.y,
		},
		context,
	});
};

const swapExpectedBoardItems = ({
	input,
	store,
}: {
	input: Parameters<DropActions["swapBoardItems"]>[0];
	store: GameRuntimeStore;
}) => {
	const context = readRuntimeDropActionContext({
		store,
	});
	const source = readExpectedBoardViewItem({
		board: context.board,
		expectedItemId: input.expectedSourceItemId,
		itemInstanceId: input.sourceBoardItemId,
	});
	const target = readExpectedBoardViewItem({
		board: context.board,
		expectedItemId: input.expectedTargetItemId,
		itemInstanceId: input.targetBoardItemId,
	});
	if (!source || !target) {
		return Promise.resolve();
	}

	return dispatchRuntimeDropAction({
		action: {
			sourceBoardItemId: input.sourceBoardItemId,
			targetBoardItemId: input.targetBoardItemId,
			type: "board.items.swap",
		},
		context,
	});
};

const swapExpectedInventorySlots = ({
	input,
	store,
}: {
	input: Parameters<DropActions["swapInventorySlots"]>[0];
	store: GameRuntimeStore;
}) => {
	const context = readRuntimeDropActionContext({
		store,
	});
	const inventory = readInventoryView(context.snapshot);
	const source = readExpectedInventorySlotStack({
		expectedItemId: input.expectedSourceItemId,
		expectedStackId: input.expectedSourceStackId,
		inventory,
		slotIndex: input.sourceSlotIndex,
	});
	const target = inventory.bySlotIndex[String(input.targetSlotIndex)]?.stack;
	if (
		!source ||
		target?.id !== input.expectedTargetStackId ||
		target?.itemId !== input.expectedTargetItemId
	) {
		return Promise.resolve();
	}

	return dispatchRuntimeDropAction({
		action: {
			sourceSlotIndex: input.sourceSlotIndex,
			targetSlotIndex: input.targetSlotIndex,
			type: "inventory.slots.swap",
		},
		context,
	});
};

const createGameRuntimeDropActions = ({ store }: { store: GameRuntimeStore }): DropActions => ({
	applyBoardItemToBoardItem: (input) =>
		applyExpectedBoardItemToBoardItem({
			input,
			store,
		}),
	applyInventoryItemToBoardItem: (input) =>
		applyExpectedInventoryItemToBoardItem({
			input,
			store,
		}),
	deleteBoardItem: (input) =>
		deleteExpectedBoardItem({
			input,
			store,
		}),
	moveBoardItem: (input) =>
		moveExpectedBoardItem({
			input,
			store,
		}),
	placeInventoryItem: (input) =>
		placeExpectedInventoryItem({
			input,
			store,
		}),
	storeBoardItem: (input) =>
		storeExpectedBoardItem({
			input,
			store,
		}),
	swapBoardItems: (input) =>
		swapExpectedBoardItems({
			input,
			store,
		}),
	swapInventorySlots: (input) =>
		swapExpectedInventorySlots({
			input,
			store,
		}),
});

export const useGameRuntimeDropActions = (): DropActions => {
	const store = useGameRuntimeStore();

	return useMemo(
		() =>
			createGameRuntimeDropActions({
				store,
			}),
		[
			store,
		],
	);
};
