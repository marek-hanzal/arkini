import { findFirstEmptyCell } from "~/v0/board/logic/findFirstEmptyCell";
import { cellKey } from "~/v0/board/util/cell";
import type { BoardView } from "./BoardViewSchema";
import type { BoardViewItem } from "./BoardViewItemSchema";

export const rebuildBoardView = (items: readonly BoardViewItem[]): BoardView => {
	const byId = Object.fromEntries(
		items.map((item) => [
			item.id,
			item,
		]),
	);
	const byCellKey = Object.fromEntries(
		items.map((item) => [
			cellKey(item.x, item.y),
			item,
		]),
	);

	return {
		items: [
			...items,
		],
		byId,
		byCellKey,
		firstEmptyCell: findFirstEmptyCell(byCellKey),
	};
};
