import { describe, expect, it } from "vitest";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import { resolveBoardCellDropAction } from "~/v0/play/drop/resolveBoardCellDropAction";

const boardItem = (props: Pick<BoardViewItem, "id" | "itemId" | "x" | "y">) =>
	({
		...props,
		state: {},
	}) satisfies BoardViewItem;

const boardSource = (item: BoardViewItem) =>
	({
		kind: "board",
		boardItemId: item.id,
		itemId: item.itemId,
		boardItem: item,
	}) satisfies DragSource;

const config = createEngineTestConfig();

describe("resolveBoardCellDropAction", () => {
	it("ignores drops onto the source item cell", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config,
				board: rebuildBoardView([
					source,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: 0,
					y: 0,
					boardItemId: source.id,
				},
			}),
		).toEqual({
			type: "ignore",
		});
	});

	it("moves board items to empty cells", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config,
				board: rebuildBoardView([
					source,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: 2,
					y: 1,
				},
			}),
		).toEqual({
			type: "move-board-item",
			input: {
				boardItemId: "source",
				x: 2,
				y: 1,
			},
		});
	});

	it("rejects cells that point to missing board items", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config,
				board: rebuildBoardView([
					source,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: 1,
					y: 3,
					boardItemId: "missing",
				},
			}),
		).toEqual({
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: "1:3",
			},
		});
	});

	it("maps regular merge intents to parallel merge actions", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target = boardItem({
			id: "target",
			itemId: "item:twig",
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config,
				board: rebuildBoardView([
					source,
					target,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: 1,
					y: 0,
					boardItemId: target.id,
				},
			}),
		).toEqual({
			type: "merge-board-items",
			animation: "parallel-merge",
			feedback: {
				kind: "merge-cell",
				cellKey: "1:0",
			},
			input: {
				sourceBoardItemId: "source",
				targetBoardItemId: "target",
			},
		});
	});

	it("uses the supplied runtime config for merge decisions", () => {
		const runtimeConfig = createEngineTestConfig({
			items: {
				...config.items,
				"item:twig": {
					...config.items["item:twig"],
					mergeIds: [],
				},
			},
		});
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target = boardItem({
			id: "target",
			itemId: "item:twig",
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config: runtimeConfig,
				board: rebuildBoardView([
					source,
					target,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: 1,
					y: 0,
					boardItemId: target.id,
				},
			}),
		).toEqual({
			type: "swap-board-items",
			animation: "parallel-swap",
			input: {
				sourceBoardItemId: "source",
				targetBoardItemId: "target",
			},
		});
	});

	it("maps non-merge occupied cells to swap actions", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target = boardItem({
			id: "target",
			itemId: "item:branch",
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config,
				board: rebuildBoardView([
					source,
					target,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: 1,
					y: 0,
					boardItemId: target.id,
				},
			}),
		).toEqual({
			type: "swap-board-items",
			animation: "parallel-swap",
			input: {
				sourceBoardItemId: "source",
				targetBoardItemId: "target",
			},
		});
	});
});
