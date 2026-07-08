import { readExpectedInventorySlotStack } from "~/inventory/view/readExpectedInventorySlotStack";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";
import type { DropActions } from "~/play/drop/DropActions";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { dispatchRuntimeDropAction } from "~/play/runtime/drop/RuntimeDropActionContext";
import { applyResolvedItemToBoardItem } from "~/play/runtime/drop/dispatchBoardItemDropActions";

const readInventoryDropState = ({ store }: { store: GameRuntimeStore }) => {
	const snapshot = store.getSnapshot();
	const nowMs = Date.now();
	return {
		board: readBoardView(snapshot, nowMs),
		config: snapshot.runtime.config,
		inventory: readInventoryView(snapshot),
		nowMs,
	};
};

export const applyExpectedInventoryItemToBoardItem = ({
	input,
	store,
}: {
	input: Parameters<DropActions["applyInventoryItemToBoardItem"]>[0];
	store: GameRuntimeStore;
}) => {
	const { board, config, inventory, nowMs } = readInventoryDropState({
		store,
	});
	const stack = readExpectedInventorySlotStack({
		expectedItemId: input.expectedSourceItemId,
		expectedStackId: input.expectedSourceStackId,
		inventory,
		slotIndex: input.sourceSlotIndex,
	});
	return applyResolvedItemToBoardItem({
		board,
		config,
		expectedSourceItemId: input.expectedSourceItemId,
		expectedTargetItemId: input.expectedTargetItemId,
		nowMs,
		sourceItemId: stack?.itemId,
		sourceRef: {
			kind: "inventory",
			quantity: 1,
			slotIndex: input.sourceSlotIndex,
		},
		store,
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
	const { inventory, nowMs } = readInventoryDropState({
		store,
	});
	const stack = readExpectedInventorySlotStack({
		expectedItemId: input.expectedItemId,
		expectedStackId: input.expectedStackId,
		inventory,
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
		nowMs,
		store,
	});
};

export const swapExpectedInventorySlots = ({
	input,
	store,
}: {
	input: Parameters<DropActions["swapInventorySlots"]>[0];
	store: GameRuntimeStore;
}) => {
	const { inventory, nowMs } = readInventoryDropState({
		store,
	});
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
		nowMs,
		store,
	});
};
