import type { GameAction } from "~/action/GameActionSchema";
import type { GameActionItemRef } from "~/action/GameActionItemRefSchema";
import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
import type { DropActions } from "~/play/drop/DropActions";
import { createGameActionFromItemToBoardItemInteractionPlan } from "~/play/interaction/createGameActionFromItemToBoardItemInteractionPlan";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import {
	dispatchRuntimeDropAction,
	readRuntimeDropActionContext,
	type RuntimeDropActionContext,
} from "~/play/runtime/drop/RuntimeDropActionContext";

type ItemToBoardItemActionSource = {
	readExpectedSourceItemId(context: RuntimeDropActionContext): string | undefined;
	readSourceQuantity?(context: RuntimeDropActionContext): number | undefined;
	readStackSourceRef?(context: RuntimeDropActionContext): GameActionItemRef | undefined;
	sourceRef: GameActionItemRef;
};

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

const createStackAction = ({
	context,
	source,
	targetItemInstanceId,
}: {
	context: RuntimeDropActionContext;
	source: ItemToBoardItemActionSource;
	targetItemInstanceId: string;
}): GameAction | undefined => {
	const sourceRef = source.readStackSourceRef?.(context) ?? source.sourceRef;
	return {
		sourceRef,
		targetItemInstanceId,
		type: "item.stack" as const,
	};
};

const readInteractionSourceRef = ({
	context,
	plan,
	source,
}: {
	context: RuntimeDropActionContext;
	plan: ItemToBoardItemInteractionPlan;
	source: ItemToBoardItemActionSource;
}) =>
	plan.type === "craft-input" || plan.type === "producer-input" || plan.type === "stack"
		? (source.readStackSourceRef?.(context) ?? source.sourceRef)
		: source.sourceRef;

const dispatchBoardItemActionWhenExpected = ({
	boardItemId,
	context,
	expectedItemId,
	readAction,
}: {
	boardItemId: string;
	context: RuntimeDropActionContext;
	expectedItemId: string;
	readAction(): Parameters<typeof dispatchRuntimeDropAction>[0]["action"];
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

export const dispatchItemToBoardItemAction = ({
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

	const plan = resolveItemToBoardItemInteractionPlan({
		config,
		sourceItemId,
		sourceQuantity: source.readSourceQuantity?.(context) ?? 1,
		targetItem: target,
	});
	const sourceRef = readInteractionSourceRef({
		context,
		plan,
		source,
	});
	const action =
		plan.type === "stack"
			? createStackAction({
					context,
					source,
					targetItemInstanceId: target.id,
				})
			: createGameActionFromItemToBoardItemInteractionPlan({
					plan,
					sourceRef,
					targetItemInstanceId: target.id,
				});

	return dispatchRuntimeDropAction({
		action:
			action ??
			createFallbackMergeAction({
				sourceRef,
				targetItemInstanceId: target.id,
			}),
		context,
	});
};

export const deleteExpectedBoardItem = ({
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

export const applyExpectedBoardItemToBoardItem = ({
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
			readSourceQuantity: ({ board }) => board.byId[input.sourceBoardItemId]?.quantity ?? 1,
			readStackSourceRef: ({ board }) => {
				const sourceItem = board.byId[input.sourceBoardItemId];
				if (!sourceItem) return undefined;
				return {
					kind: "board" as const,
					itemInstanceId: input.sourceBoardItemId,
					quantity: sourceItem.quantity ?? 1,
				};
			},
			sourceRef: {
				kind: "board",
				itemInstanceId: input.sourceBoardItemId,
			},
		},
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

export const storeExpectedBoardItem = ({
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

export const swapExpectedBoardItems = ({
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
