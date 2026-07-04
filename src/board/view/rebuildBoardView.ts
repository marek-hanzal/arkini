import { findFirstEmptyCell } from "~/board/findFirstEmptyCell";
import { cellKey } from "~/board/cellKey";
import type { BoardView } from "./BoardViewSchema";
import type { BoardViewItem } from "./BoardViewItemSchema";

export namespace rebuildBoardView {
	export interface Layout {
		height: number;
		width: number;
	}
}

const readFallbackLayout = (items: readonly BoardViewItem[]): rebuildBoardView.Layout => ({
	height: Math.max(0, ...items.map((item) => item.y + 1)),
	width: Math.max(0, ...items.map((item) => item.x + 1)),
});

export const rebuildBoardView = (
	items: readonly BoardViewItem[],
	layout: rebuildBoardView.Layout = readFallbackLayout(items),
): BoardView => {
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
		firstEmptyCell: findFirstEmptyCell({
			height: layout.height,
			occupiedCellKeys: new Set(Object.keys(byCellKey)),
			width: layout.width,
		}),
	};
};
