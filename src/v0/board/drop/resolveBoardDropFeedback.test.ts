import { describe, expect, it } from "vitest";
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

	it("marks stored requirement targets as primary merge feedback", () => {
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
				requirements: [
					{
						capacity: 1,
						itemId: "item:twig",
						quantity: 1,
						stored: 0,
						type: "stored",
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
			variant: "primary",
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
				productLines: [
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
						missingRequirementItemIds: [],
						name: "Test product",
						producerQueuedJobs: 0,
						productId: "product:test",
						queueFull: false,
						blocked: false,
						blockReasonEffectIds: [],
						queuedJobs: 0,
						queueSize: 1,
						requirementItemIds: [],
						requirementsReady: true,
					},
				],
				requirements: [],
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

	it("does not show blocked feedback for plain swap targets", () => {
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
		).toBeNull();
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
