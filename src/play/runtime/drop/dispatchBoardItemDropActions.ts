import type { GameAction } from "~/action/GameActionSchema";
import type { GameActionItemRef } from "~/action/GameActionItemRefSchema";
import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { DropActions } from "~/play/drop/DropActions";
import {
	readItemToBoardItemInteractionCommit,
	resolveItemToBoardItemInteractionPlan,
} from "~/play/interaction/resolveItemToBoardItemInteractionPlan";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { dispatchRuntimeDropAction } from "~/play/runtime/drop/RuntimeDropActionContext";
import { readRuntimeViews } from "~/play/runtime/readRuntimeViews";

const createFallbackMergeAction = ({
	sourceRef,
	targetItemInstanceId,
}: {
	sourceRef: GameActionItemRef;
	targetItemInstanceId: string;
}) => ({
	sourceRef,
	targetItemInstanceId,
	type: "item.merge" as const,
});

const readBoardDropState = ({ store }: { store: GameRuntimeStore }) =>
	readRuntimeViews(store.getSnapshot(), Date.now());

const dispatchBoardItemActionWhenExpected = ({
	board,
	boardItemId,
	expectedItemId,
	nowMs,
	readAction,
	store,
}: {
	board: BoardView;
	boardItemId: string;
	expectedItemId: string;
	nowMs: number;
	readAction(): GameAction;
	store: GameRuntimeStore;
}) => {
	const boardItem = readExpectedBoardViewItem({
		board,
		expectedItemId,
		itemInstanceId: boardItemId,
	});
	if (!boardItem) return Promise.resolve();

	return dispatchRuntimeDropAction({
		action: readAction(),
		nowMs,
		store,
	});
};

export const applyResolvedItemToBoardItem = ({
	board,
	config,
	expectedSourceItemId,
	expectedTargetItemId,
	nowMs,
	sourceItemId,
	sourceQuantity = 1,
	sourceRef,
	store,
	targetBoardItemId,
}: {
	board: BoardView;
	config: GameConfig;
	expectedSourceItemId: string;
	expectedTargetItemId: string;
	nowMs: number;
	sourceItemId: string | undefined;
	sourceQuantity?: number;
	sourceRef: GameActionItemRef;
	store: GameRuntimeStore;
	targetBoardItemId: string;
}) => {
	const target = readExpectedBoardViewItem({
		board,
		expectedItemId: expectedTargetItemId,
		itemInstanceId: targetBoardItemId,
	});
	if (!sourceItemId || sourceItemId !== expectedSourceItemId || !target) {
		return Promise.resolve();
	}

	const plan = resolveItemToBoardItemInteractionPlan({
		config,
		sourceItemId,
		sourceQuantity,
		targetItem: target,
	});
	const commit = readItemToBoardItemInteractionCommit({
		plan,
		sourceRef,
		targetItemInstanceId: target.id,
	});

	return dispatchRuntimeDropAction({
		action:
			commit.action ??
			createFallbackMergeAction({
				sourceRef: commit.sourceRef,
				targetItemInstanceId: target.id,
			}),
		nowMs,
		store,
	});
};

export const deleteExpectedBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["deleteBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const { board, nowMs } = readBoardDropState({
		store,
	});
	return dispatchBoardItemActionWhenExpected({
		board,
		boardItemId: input.boardItemId,
		expectedItemId: input.expectedItemId,
		nowMs,
		readAction: () => ({
			boardItemId: input.boardItemId,
			expectedItemId: input.expectedItemId,
			type: "debug.board_item.delete",
		}),
		store,
	});
};

export const applyExpectedBoardItemToBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["applyBoardItemToBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const { board, config, nowMs } = readBoardDropState({
		store,
	});
	const sourceItem = board.byId[input.sourceBoardItemId];
	return applyResolvedItemToBoardItem({
		board,
		config,
		expectedSourceItemId: input.expectedSourceItemId,
		expectedTargetItemId: input.expectedTargetItemId,
		nowMs,
		sourceItemId: sourceItem?.itemId,
		sourceQuantity: sourceItem?.quantity ?? 1,
		sourceRef: {
			kind: "board",
			itemInstanceId: input.sourceBoardItemId,
			quantity: sourceItem?.quantity ?? 1,
		},
		store,
		targetBoardItemId: input.targetBoardItemId,
	});
};

export const moveExpectedBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["moveBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const { board, nowMs } = readBoardDropState({
		store,
	});
	return dispatchBoardItemActionWhenExpected({
		board,
		boardItemId: input.boardItemId,
		expectedItemId: input.expectedItemId,
		nowMs,
		readAction: () => ({
			boardItemId: input.boardItemId,
			type: "board.item.move",
			x: input.x,
			y: input.y,
		}),
		store,
	});
};

export const storeExpectedBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["storeBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const { board, nowMs } = readBoardDropState({
		store,
	});
	return dispatchBoardItemActionWhenExpected({
		board,
		boardItemId: input.boardItemId,
		expectedItemId: input.expectedItemId,
		nowMs,
		readAction: () => ({
			boardItemId: input.boardItemId,
			type: "board.item.stash",
		}),
		store,
	});
};

export const swapExpectedBoardItems = ({
	input,
	store,
}: {
	input: Parameters<DropActions["swapBoardItems"]>[0];
	store: GameRuntimeStore;
}) => {
	const { board, nowMs } = readBoardDropState({
		store,
	});
	const source = readExpectedBoardViewItem({
		board,
		expectedItemId: input.expectedSourceItemId,
		itemInstanceId: input.sourceBoardItemId,
	});
	const target = readExpectedBoardViewItem({
		board,
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
		nowMs,
		store,
	});
};
