import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import { readRuntimeUpgradeListViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeUpgradeListViewFromGameSave";
import type { UpgradeListView } from "~/v0/upgrade/view/UpgradeListViewSchema";
import { useGameRuntimeSelector } from "~/v0/play/runtime/GameRuntimeContext";

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

const sameInventorySlot = (left: InventorySlot, right: InventorySlot) => {
	if (left === right) return true;

	const leftStack = left.stack;
	const rightStack = right.stack;
	return (
		left.slotIndex === right.slotIndex &&
		leftStack?.id === rightStack?.id &&
		leftStack?.itemId === rightStack?.itemId &&
		leftStack?.quantity === rightStack?.quantity &&
		leftStack?.stateJson === rightStack?.stateJson
	);
};

export const useGameBoardView = (): BoardView => useGameRuntimeSelector((state) => state.board);

export const useGameInventoryView = (): InventoryView =>
	useGameRuntimeSelector((state) => state.inventory);

export const useGameBoardItem = (boardItemId: string): BoardViewItem | null =>
	useGameRuntimeSelector((state) => state.board.byId[boardItemId] ?? null, sameBoardItem);

export const useGameInventorySlot = (slotIndex: number): InventorySlot =>
	useGameRuntimeSelector(
		(state) =>
			state.inventory.bySlotIndex[String(slotIndex)] ?? {
				slotIndex,
			},
		sameInventorySlot,
	);

export const useGameUpgradeListView = (): UpgradeListView =>
	useGameRuntimeSelector((state) =>
		readRuntimeUpgradeListViewFromGameSave({
			config: state.runtime.config,
			nowMs: Date.now(),
			save: state.runtime.save,
		}),
	);

export const useGameItemCatalogView = (): ItemCatalogView =>
	useGameRuntimeSelector((state) => state.items);

export const useGameItemView = (itemId: ItemId | string | undefined): ViewItem | null =>
	useGameRuntimeSelector((state) => (itemId ? (state.items[itemId as ItemId] ?? null) : null));
