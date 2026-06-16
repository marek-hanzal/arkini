import { describe, expect, it } from "vitest";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardCellView } from "~/v0/board/boardCells";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";
import { resolveBoardDropFeedback } from "./resolveBoardDropFeedback";

const boardItem = (props: Pick<BoardViewItem, "id" | "itemId" | "x" | "y">): BoardViewItem => ({
	...props,
	state: {},
});

const boardView = (items: readonly BoardViewItem[]): BoardView => ({
	items: [
		...items,
	],
	byId: Object.fromEntries(
		items.map((item) => [
			item.id,
			item,
		]),
	),
	byCellKey: {},
});

const context = (
	props: Pick<
		TileEngine.DragOverContext<BoardSurface.TileData, BoardCellView, DragSource, DropTarget>,
		"source" | "target" | "targetTile"
	>,
): TileEngine.DragOverContext<BoardSurface.TileData, BoardCellView, DragSource, DropTarget> => ({
	...props,
	targetSlot: null,
	dropId: "board-cell:0:0",
});

describe("resolveBoardDropFeedback", () => {
	it("marks empty board cells as empty feedback", () => {
		const source = boardItem({
			id: "a",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});

		expect(
			resolveBoardDropFeedback({
				board: boardView([
					source,
				]),
				context: context({
					source: {
						kind: "board",
						boardItemId: source.id,
						itemId: source.itemId,
						boardItem: source,
					},
					target: {
						kind: "cell",
						x: 1,
						y: 0,
					},
					targetTile: null,
				}),
			}),
		).toEqual({
			effect: "empty",
		});
	});

	it("marks mergeable target items as merge feedback", () => {
		const source = boardItem({
			id: "a",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target = boardItem({
			id: "b",
			itemId: "item:twig",
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardDropFeedback({
				board: boardView([
					source,
					target,
				]),
				context: context({
					source: {
						kind: "board",
						boardItemId: source.id,
						itemId: source.itemId,
						boardItem: source,
					},
					target: {
						kind: "cell",
						x: target.x,
						y: target.y,
						boardItemId: target.id,
					},
					targetTile: {
						id: target.id,
						slotId: "1:0",
						data: {
							kind: "board-item",
							boardItemId: target.id,
						},
					},
				}),
			}),
		).toEqual({
			effect: "merge",
		});
	});

	it("marks occupied non-merge targets as blocked feedback", () => {
		const source = boardItem({
			id: "a",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target = boardItem({
			id: "b",
			itemId: "item:branch",
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardDropFeedback({
				board: boardView([
					source,
					target,
				]),
				context: context({
					source: {
						kind: "board",
						boardItemId: source.id,
						itemId: source.itemId,
						boardItem: source,
					},
					target: {
						kind: "cell",
						x: target.x,
						y: target.y,
						boardItemId: target.id,
					},
					targetTile: {
						id: target.id,
						slotId: "1:0",
						data: {
							kind: "board-item",
							boardItemId: target.id,
						},
					},
				}),
			}),
		).toEqual({
			effect: "blocked",
		});
	});
});
