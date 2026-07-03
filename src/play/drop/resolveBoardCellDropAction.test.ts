import { describe, expect, it } from "vitest";
import { cheatBoardItemId, inventoryBoardItemId } from "~/board/BoardUtilityItem";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { createEngineMergeTestConfig } from "~/engine/test/createEngineMergeTestConfig";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { DragSource } from "~/play/drag/DragSource";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import { resolveBoardCellDropAction } from "~/play/drop/resolveBoardCellDropAction";

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

const boardMoveInput = (
	item: BoardViewItem,
	cell: {
		x: number;
		y: number;
	},
) => ({
	boardItemId: item.id,
	expectedItemId: item.itemId,
	x: cell.x,
	y: cell.y,
});

const boardPairInput = (source: BoardViewItem, target: BoardViewItem) => ({
	expectedSourceItemId: source.itemId,
	expectedTargetItemId: target.itemId,
	sourceBoardItemId: source.id,
	targetBoardItemId: target.id,
});

const config = createEngineTestConfig();
const emptyInventory = rebuildInventoryView([]);
const inventoryWithEmptySlot = rebuildInventoryView([
	{
		slotIndex: 0,
	},
]);
const directionalMergeConfig = createEngineMergeTestConfig();

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
				inventory: emptyInventory,
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
				inventory: emptyInventory,
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
			input: boardMoveInput(source, {
				x: 2,
				y: 1,
			}),
		});
	});

	it("stores board items dropped onto the inventory board item", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const inventoryTarget = boardItem({
			id: "inventory",
			itemId: inventoryBoardItemId,
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config,
				inventory: inventoryWithEmptySlot,
				board: rebuildBoardView([
					source,
					inventoryTarget,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: inventoryTarget.x,
					y: inventoryTarget.y,
					boardItemId: inventoryTarget.id,
				},
			}),
		).toEqual({
			feedback: {
				cellKey: "1:0",
				kind: "cell-feedback",
				variant: "primary",
			},
			input: {
				boardItemId: source.id,
				expectedItemId: source.itemId,
			},
			type: "store-board-item-in-inventory",
		});
	});

	it("deletes board items dropped onto the cheat inventory board item", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const cheatTarget = boardItem({
			id: "cheat",
			itemId: cheatBoardItemId,
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config,
				inventory: emptyInventory,
				board: rebuildBoardView([
					source,
					cheatTarget,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: cheatTarget.x,
					y: cheatTarget.y,
					boardItemId: cheatTarget.id,
				},
			}),
		).toEqual({
			animation: "consume",
			feedback: {
				cellKey: "1:0",
				kind: "cell-feedback",
				variant: "danger",
			},
			input: {
				boardItemId: source.id,
				expectedItemId: source.itemId,
			},
			type: "delete-board-item",
		});
	});

	it("rejects board-only items dropped onto the inventory board item", () => {
		const source = boardItem({
			id: "source",
			itemId: inventoryBoardItemId,
			x: 0,
			y: 0,
		});
		const inventoryTarget = boardItem({
			id: "inventory",
			itemId: inventoryBoardItemId,
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config,
				inventory: inventoryWithEmptySlot,
				board: rebuildBoardView([
					source,
					inventoryTarget,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: inventoryTarget.x,
					y: inventoryTarget.y,
					boardItemId: inventoryTarget.id,
				},
			}),
		).toEqual({
			feedback: {
				cellKey: "1:0",
				kind: "board-cell",
			},
			type: "reject",
		});
	});

	it("uses the live empty cell instead of a stale target item id", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config,
				inventory: emptyInventory,
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
			type: "move-board-item",
			input: boardMoveInput(source, {
				x: 1,
				y: 3,
			}),
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
				inventory: emptyInventory,
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
			input: boardPairInput(source, target),
		});
	});

	it("maps only source-owned explicit merge rules to merge actions", () => {
		const twig = boardItem({
			id: "twig",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const water = boardItem({
			id: "water",
			itemId: "item:water",
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardCellDropAction({
				config: directionalMergeConfig,
				inventory: emptyInventory,
				board: rebuildBoardView([
					twig,
					water,
				]),
				source: boardSource(water),
				target: {
					kind: "cell",
					x: 0,
					y: 0,
					boardItemId: twig.id,
				},
			}),
		).toMatchObject({
			animation: "parallel-merge",
			type: "merge-board-items",
		});

		expect(
			resolveBoardCellDropAction({
				config: directionalMergeConfig,
				inventory: emptyInventory,
				board: rebuildBoardView([
					twig,
					water,
				]),
				source: boardSource(twig),
				target: {
					kind: "cell",
					x: 1,
					y: 0,
					boardItemId: water.id,
				},
			}),
		).toMatchObject({
			animation: "parallel-swap",
			type: "swap-board-items",
		});
	});

	it("uses the live target cell item instead of a stale empty target snapshot", () => {
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
				inventory: emptyInventory,
				board: rebuildBoardView([
					source,
					target,
				]),
				source: boardSource(source),
				target: {
					kind: "cell",
					x: 1,
					y: 0,
				},
			}),
		).toEqual({
			type: "merge-board-items",
			animation: "parallel-merge",
			feedback: {
				kind: "merge-cell",
				cellKey: "1:0",
			},
			input: boardPairInput(source, target),
		});
	});

	it("rejects stale board drag sources whose live item id changed", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:water",
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
				config: directionalMergeConfig,
				inventory: emptyInventory,
				board: rebuildBoardView([
					source,
					target,
				]),
				source: {
					...boardSource(source),
					itemId: "item:twig",
				},
				target: {
					kind: "cell",
					x: 1,
					y: 0,
					boardItemId: target.id,
				},
			}),
		).toEqual({
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: "1:0",
			},
		});
	});

	it("rejects stale board drag sources that no longer exist in the live board view", () => {
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
				inventory: emptyInventory,
				board: rebuildBoardView([
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
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: "1:0",
			},
		});
	});

	it("uses the supplied runtime config for merge decisions", () => {
		const runtimeConfig = createEngineTestConfig({
			items: {
				...config.items,
				"item:twig": {
					...config.items["item:twig"],
					merges: [],
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
				inventory: emptyInventory,
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
			input: boardPairInput(source, target),
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
				inventory: emptyInventory,
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
			input: boardPairInput(source, target),
		});
	});

	it("does not treat passive grants as droppable stored slots", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target = {
			id: "target",
			itemId: "item:branch",
			state: {},
			x: 1,
			y: 0,
			activation: {
				inputs: [],
				kind: "producer",
				trigger: "click",
			},
		} satisfies BoardViewItem;

		expect(
			resolveBoardCellDropAction({
				config,
				inventory: emptyInventory,
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
			input: boardPairInput(source, target),
		});
	});

	it("applies board items to stash inputs", () => {
		const source = boardItem({
			id: "source",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target = {
			id: "target",
			itemId: "item:branch",
			state: {},
			x: 1,
			y: 0,
			activation: {
				inputs: [
					{
						capacity: 1,
						consume: true,
						itemId: "item:twig",
						quantity: 1,
						stored: 0,
					},
				],
				kind: "stash",
				trigger: "click",
			},
		} satisfies BoardViewItem;

		expect(
			resolveBoardCellDropAction({
				config,
				inventory: emptyInventory,
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
			type: "apply-board-item-to-board-item",
			feedback: {
				cellKey: "1:0",
				kind: "cell-feedback",
				variant: "secondary",
			},
			input: boardPairInput(source, target),
		});
	});
});
