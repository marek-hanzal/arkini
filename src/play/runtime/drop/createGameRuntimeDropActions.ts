import type { DropActions } from "~/play/drop/DropActions";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import {
	applyExpectedBoardItemToBoardItem,
	deleteExpectedBoardItem,
	moveExpectedBoardItem,
	storeExpectedBoardItem,
	swapExpectedBoardItems,
} from "~/play/runtime/drop/dispatchBoardItemDropActions";
import {
	applyExpectedInventoryItemToBoardItem,
	placeExpectedInventoryItem,
	swapExpectedInventorySlots,
} from "~/play/runtime/drop/dispatchInventoryDropActions";

export const createGameRuntimeDropActions = ({
	store,
}: {
	store: GameRuntimeStore;
}): DropActions => ({
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
