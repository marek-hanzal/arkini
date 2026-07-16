import type { BoardCellSchema } from "~/board/schema/BoardCellSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { BoardView } from "~/board/view/BoardViewSchema";
import { cellKey } from "~/board/cellKey";
import { findFirstEmptyCell } from "~/board/findFirstEmptyCell";
import type { ItemId } from "~/config/IdSchema";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import { readRuntimeBoardItemViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeBoardItemViewFromGameSave";
import { readRuntimeBoardViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";
import { readRuntimeInventorySlotFromGameSave } from "~/play/game-engine-bridge/readRuntimeInventorySlotFromGameSave";
import { readRuntimeInventoryViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeInventoryViewFromGameSave";
import { readRuntimeItemCatalogViewFromGameConfig } from "~/play/game-engine-bridge/readRuntimeItemCatalogViewFromGameConfig";
import type { GameRuntimeState } from "~/play/runtime/GameRuntimeStore";

export const readRuntimeBoardView = (state: GameRuntimeState, nowMs = state.nowMs): BoardView =>
	readRuntimeBoardViewFromGameSave({
		config: state.runtime.config,
		nowMs,
		save: state.runtime.save,
	});

export const readRuntimeBoardItem = ({
	boardItemId,
	state,
	nowMs = state.nowMs,
}: {
	boardItemId: string;
	state: GameRuntimeState;
	nowMs?: number;
}): BoardViewItem | undefined =>
	readRuntimeBoardItemViewFromGameSave({
		boardItemId,
		config: state.runtime.config,
		nowMs,
		save: state.runtime.save,
	});

export const readRuntimeInventoryView = (state: GameRuntimeState): InventoryView =>
	readRuntimeInventoryViewFromGameSave({
		config: state.runtime.config,
		save: state.runtime.save,
	});

export const readRuntimeInventorySlot = ({
	slotIndex,
	state,
}: {
	slotIndex: number;
	state: GameRuntimeState;
}): InventorySlot =>
	readRuntimeInventorySlotFromGameSave({
		save: state.runtime.save,
		slotIndex,
	});

export const readRuntimeItemCatalogView = (state: GameRuntimeState): ItemCatalogView =>
	readRuntimeItemCatalogViewFromGameConfig(state.runtime.config);

export const readRuntimeItemView = ({
	itemId,
	state,
}: {
	itemId: ItemId | string | undefined;
	state: GameRuntimeState;
}): ViewItem | undefined =>
	itemId ? readRuntimeItemCatalogView(state)[itemId as ItemId] : undefined;

export const readRuntimeBoardFirstEmptyCell = (
	state: GameRuntimeState,
): BoardCellSchema.Type | undefined => {
	const { width, height } = state.runtime.config.game.board;
	const occupied = new Set(
		Object.values(state.runtime.save.board.items).map((item) => cellKey(item.x, item.y)),
	);

	return findFirstEmptyCell({
		height,
		occupiedCellKeys: occupied,
		width,
	});
};

export const readRuntimeViews = (
	state: GameRuntimeState,
	nowMs = state.nowMs,
): {
	board: BoardView;
	config: GameRuntimeState["runtime"]["config"];
	inventory: InventoryView;
	nowMs: number;
} => ({
	board: readRuntimeBoardView(state, nowMs),
	config: state.runtime.config,
	inventory: readRuntimeInventoryView(state),
	nowMs,
});

export {
	readRuntimeBoardFirstEmptyCell as readBoardFirstEmptyCell,
	readRuntimeBoardItem as readBoardItem,
	readRuntimeBoardView as readBoardView,
	readRuntimeInventorySlot as readInventorySlot,
	readRuntimeInventoryView as readInventoryView,
	readRuntimeItemCatalogView as readItemCatalogView,
	readRuntimeItemView as readItemView,
};
