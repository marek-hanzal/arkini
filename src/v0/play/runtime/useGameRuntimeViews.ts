import { useCallback } from "react";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { BoardCellSchema } from "~/v0/board/schema/BoardCellSchema";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { useGameRuntimeSelector } from "~/v0/play/runtime/GameRuntimeContext";
import {
	readBoardFirstEmptyCell,
	readBoardItem,
	readBoardView,
	readInventoryView,
	readItemCatalogView,
	readItemView,
} from "~/v0/play/runtime/readers";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

const stableStringify = (value: unknown) => JSON.stringify(value ?? null);

const sameBoardItem = (left: BoardViewItem | null, right: BoardViewItem | null) => {
	if (left === right) return true;
	if (!left || !right) return false;

	return (
		left.id === right.id &&
		left.itemId === right.itemId &&
		left.x === right.x &&
		left.y === right.y &&
		stableStringify(left.activation) === stableStringify(right.activation) &&
		stableStringify(left.craft) === stableStringify(right.craft) &&
		stableStringify(left.state) === stableStringify(right.state)
	);
};

const sameBoardCell = (
	left: BoardCellSchema.Type | undefined,
	right: BoardCellSchema.Type | undefined,
) => left?.x === right?.x && left?.y === right?.y;

const sameInventorySlot = (left: InventorySlot, right: InventorySlot) => {
	if (left === right) return true;

	const leftStack = left.stack;
	const rightStack = right.stack;
	return (
		left.slotIndex === right.slotIndex &&
		leftStack?.id === rightStack?.id &&
		leftStack?.itemId === rightStack?.itemId &&
		leftStack?.quantity === rightStack?.quantity
	);
};

const sameBoardView = (left: BoardView, right: BoardView) =>
	left.items.length === right.items.length &&
	sameBoardCell(left.firstEmptyCell, right.firstEmptyCell) &&
	left.items.every((leftItem, index) => sameBoardItem(leftItem, right.items[index] ?? null));

const sameInventoryView = (left: InventoryView, right: InventoryView) =>
	left.slots.length === right.slots.length &&
	left.firstEmptySlotIndex === right.firstEmptySlotIndex &&
	left.slots.every((leftSlot, index) => sameInventorySlot(leftSlot, right.slots[index]));

export const useGameBoardView = (): BoardView =>
	useGameRuntimeSelector(readBoardView, sameBoardView);

export const useGameInventoryView = (): InventoryView =>
	useGameRuntimeSelector(readInventoryView, sameInventoryView);

export const useGameBoardItem = (boardItemId: string): BoardViewItem | null => {
	const selector = useCallback(
		(state: GameRuntimeState) =>
			readBoardItem({
				boardItemId,
				state,
			}) ?? null,
		[
			boardItemId,
		],
	);

	return useGameRuntimeSelector(selector, sameBoardItem);
};

export const useGameBoardFirstEmptyCell = (): BoardCellSchema.Type | undefined =>
	useGameRuntimeSelector(readBoardFirstEmptyCell, sameBoardCell);

export const useGameItemCatalogView = (): ItemCatalogView =>
	useGameRuntimeSelector(readItemCatalogView);

export const useGameItemView = (itemId: ItemId | string | undefined): ViewItem | null => {
	const selector = useCallback(
		(state: GameRuntimeState) =>
			readItemView({
				itemId,
				state,
			}) ?? null,
		[
			itemId,
		],
	);

	return useGameRuntimeSelector(selector);
};
