import { readExpectedInventorySlotStack } from "~/inventory/view/readExpectedInventorySlotStack";
import type { DropActions } from "~/play/drop/DropActions";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import {
	dispatchRuntimeDropAction,
	readRuntimeDropActionContext,
} from "~/play/runtime/drop/RuntimeDropActionContext";
import { dispatchItemToBoardItemAction } from "~/play/runtime/drop/dispatchBoardItemDropActions";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";

export const applyExpectedInventoryItemToBoardItem = ({
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

export const placeExpectedInventoryItem = ({
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

export const swapExpectedInventorySlots = ({
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
