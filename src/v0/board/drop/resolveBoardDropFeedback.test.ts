import { describe, expect, it } from "vitest";
import { inventoryBoardItemId } from "~/v0/board/BoardUtilityItem";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { BoardCellView } from "~/v0/board/boardCells";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";
import { resolveBoardDropFeedback } from "./resolveBoardDropFeedback";

const boardItem = (props: Pick<BoardViewItem, "id" | "itemId" | "x" | "y">): BoardViewItem => ({
	...props,
	state: {},
});

const boardView = rebuildBoardView;

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

const config = createEngineTestConfig();
const emptyInventory = rebuildInventoryView([]);
const inventoryWithEmptySlot = rebuildInventoryView([
	{
		slotIndex: 0,
	},
]);

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
				config,
				inventory: emptyInventory,
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

	it("blocks empty board cell feedback for inventory-only items", () => {
		const inventoryOnlyConfig = createEngineTestConfig({
			items: {
				...config.items,
				"item:inventory-only": {
					...config.items["item:twig"],
					description: "Inventory only",
					merges: [],
					name: "Inventory Only",
					storage: "inventory",
				},
			},
		});
		const inventory = rebuildInventoryView([
			{
				slotIndex: 0,
				stack: {
					id: "stack:inventory-only",
					itemId: "item:inventory-only",
					quantity: 1,
				},
			},
		]);

		expect(
			resolveBoardDropFeedback({
				config: inventoryOnlyConfig,
				inventory,
				board: boardView([]),
				context: context({
					source: {
						kind: "inventory",
						slot: inventory.bySlotIndex["0"]!,
						itemId: "item:inventory-only",
						slotIndex: 0,
					},
					target: {
						kind: "cell",
						x: 0,
						y: 0,
					},
					targetTile: null,
				}),
			}),
		).toEqual({
			effect: "blocked",
		});
	});

	it("blocks empty board cell feedback when the dragged inventory source is stale", () => {
		expect(
			resolveBoardDropFeedback({
				config,
				inventory: emptyInventory,
				board: boardView([]),
				context: context({
					source: {
						kind: "inventory",
						slot: {
							slotIndex: 0,
						},
						itemId: "item:twig",
						slotIndex: 0,
					},
					target: {
						kind: "cell",
						x: 0,
						y: 0,
					},
					targetTile: null,
				}),
			}),
		).toEqual({
			effect: "blocked",
		});
	});

	it("blocks empty board cell feedback when the dragged board source item changed", () => {
		const source = boardItem({
			id: "a",
			itemId: "item:water",
			x: 0,
			y: 0,
		});

		expect(
			resolveBoardDropFeedback({
				config,
				inventory: emptyInventory,
				board: boardView([
					source,
				]),
				context: context({
					source: {
						kind: "board",
						boardItemId: source.id,
						itemId: "item:twig",
						boardItem: {
							...source,
							itemId: "item:twig",
						},
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
			effect: "blocked",
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
				config,
				inventory: emptyInventory,
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

	it("marks inventory board item targets as primary merge feedback when the source can be stored", () => {
		const source = boardItem({
			id: "a",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target = boardItem({
			id: "inventory",
			itemId: inventoryBoardItemId,
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardDropFeedback({
				config,
				inventory: inventoryWithEmptySlot,
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
			variant: "primary",
		});
	});

	it("blocks inventory board item targets when the source cannot be stored", () => {
		const source = boardItem({
			id: "a",
			itemId: inventoryBoardItemId,
			x: 0,
			y: 0,
		});
		const target = boardItem({
			id: "inventory",
			itemId: inventoryBoardItemId,
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardDropFeedback({
				config,
				inventory: inventoryWithEmptySlot,
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

	it("marks producer input targets as secondary merge feedback", () => {
		const source = boardItem({
			id: "a",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target: BoardViewItem = {
			id: "b",
			itemId: "item:lumber-camp-1",
			state: {},
			x: 1,
			y: 0,
			activation: {
				inputs: [],
				kind: "producer",
				producerLines: [
					{
						durationMs: 1000,
						inProgress: false,
						isDefault: true,
						inputItemIds: [
							"item:twig",
						],
						inputs: [
							{
								capacity: 1,
								consume: true,
								itemId: "item:twig",
								quantity: 1,
								stored: 0,
							},
						],
						inputsReady: false,
						inputsAvailable: false,
						name: "Test product",
						lineKind: "product" as const,
						producerQueuedJobs: 0,
						lineId: "line:test",
						queueFull: false,
						blocked: false,
						queuedJobs: 0,
						queueSize: 1,
					},
				],
				trigger: "click",
			},
		};

		expect(
			resolveBoardDropFeedback({
				config,
				inventory: emptyInventory,
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
			variant: "secondary",
		});
	});

	it("marks stash inputs as secondary merge feedback when shared product-line views are present", () => {
		const source = boardItem({
			id: "a",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		const target: BoardViewItem = {
			id: "b",
			itemId: "item:stash",
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
				producerLines: [
					{
						durationMs: 1000,
						inProgress: false,
						inputItemIds: [
							"item:twig",
						],
						inputs: [
							{
								capacity: 1,
								consume: true,
								itemId: "item:twig",
								quantity: 1,
								stored: 0,
							},
						],
						inputsAvailable: true,
						inputsReady: false,
						isDefault: false,
						name: "Open stash",
						lineKind: "product" as const,
						producerQueuedJobs: 0,
						lineId: "line:stash",
						queueFull: false,
						blocked: false,
						queuedJobs: 0,
						queueSize: 1,
					},
				],
				trigger: "click",
			},
		};

		expect(
			resolveBoardDropFeedback({
				config,
				inventory: emptyInventory,
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
			variant: "secondary",
		});
	});

	it("marks plain board swap targets as blocked target feedback", () => {
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
				config,
				inventory: emptyInventory,
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
	it("marks inventory drops to plain swap targets as blocked feedback", () => {
		const target = boardItem({
			id: "b",
			itemId: "item:branch",
			x: 1,
			y: 0,
		});

		expect(
			resolveBoardDropFeedback({
				config,
				inventory: emptyInventory,
				board: boardView([
					target,
				]),
				context: context({
					source: {
						kind: "inventory",
						itemId: "item:twig",
						slotIndex: 0,
						slot: {
							slotIndex: 0,
							stack: {
								id: "stack:twig",
								itemId: "item:twig",
								quantity: 1,
							},
						},
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
