import { describe, expect, it, vi } from "vitest";
import { cheatBoardItemId } from "~/board/BoardUtilityItem";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { resolveDrop } from "~/play/drop/resolveDrop";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { DropActions } from "~/play/drop/DropActions";
import type { Feedback } from "~/play/feedback/Feedback";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

const rect = {
	left: 0,
	top: 0,
	width: 64,
	height: 64,
} satisfies TileEngine.Rect;

const config = createEngineTestConfig();

const emptyBoard = {
	byCellKey: {},
	byId: {},
	firstEmptyCell: {
		x: 0,
		y: 0,
	},
	items: [],
} satisfies BoardView;

const emptyInventory = {
	bySlotIndex: {},
	firstEmptySlotIndex: 0,
	slots: [],
	stacksByItemId: {},
} satisfies InventoryView;

const inventorySlot = (slotIndex: number) =>
	({
		slotIndex,
		stack: {
			id: `stack-${slotIndex}`,
			itemId: "item:twig",
			quantity: 1,
		},
	}) satisfies InventorySlot;

const inventoryWithSwapSource = {
	bySlotIndex: {
		0: inventorySlot(0),
		1: inventorySlot(1),
	},
	firstEmptySlotIndex: undefined,
	slots: [
		inventorySlot(0),
		inventorySlot(1),
	],
	stacksByItemId: {
		"item:twig": [
			inventorySlot(0),
			inventorySlot(1),
		],
	},
} satisfies InventoryView;

const boardItem = ({ id, x, y }: { id: string; x: number; y: number }) =>
	({
		id,
		itemId: "item:twig",
		state: {},
		x,
		y,
	}) satisfies BoardViewItem;

describe("resolveDrop animation contract", () => {
	it("preserves parallel swap runtime animation when wrapping commits with error feedback", async () => {
		const swapInventorySlots = vi.fn(async () => undefined);
		const feedback = {
			showError: vi.fn(),
		} as unknown as Feedback.Type;
		const actions = {
			deleteBoardItem: vi.fn(),
			applyBoardItemToBoardItem: vi.fn(),
			applyInventoryItemToBoardItem: vi.fn(),
			moveBoardItem: vi.fn(),
			placeInventoryItem: vi.fn(),
			swapBoardItems: vi.fn(),
			storeBoardItem: vi.fn(),
			swapInventorySlots,
		} satisfies DropActions;

		const outcome = resolveDrop({
			actions,
			config,
			board: emptyBoard,
			feedback,
			inventory: inventoryWithSwapSource,
			context: {
				dragRect: rect,
				source: {
					kind: "inventory",
					itemId: "item:twig",
					slot: inventorySlot(0),
					slotIndex: 0,
				} satisfies DragSource,
				sourceTile: {
					id: "source-stack",
					slotId: "0",
					data: {},
				},
				target: {
					kind: "inventory-slot",
					slotIndex: 1,
				} satisfies DropTarget,
				targetRect: rect,
				targetSlot: {
					id: "1",
					data: {},
				},
				targetTile: {
					id: "target-stack",
					slotId: "1",
					data: {},
				},
			},
		});

		expect(outcome).toMatchObject({
			animation: "parallel-swap",
			type: "accept",
		});

		if (typeof outcome !== "string" && outcome.type === "accept") {
			await outcome.commit?.();
		}

		expect(swapInventorySlots).toHaveBeenCalledWith({
			expectedSourceItemId: "item:twig",
			expectedSourceStackId: "stack-0",
			expectedTargetItemId: "item:twig",
			expectedTargetStackId: "stack-1",
			sourceSlotIndex: 0,
			targetSlotIndex: 1,
		});
	});

	it("rejects board item drops onto the inventory target", () => {
		const feedback = {
			showError: vi.fn(),
		} as unknown as Feedback.Type;
		const actions = {
			deleteBoardItem: vi.fn(),
			applyBoardItemToBoardItem: vi.fn(),
			applyInventoryItemToBoardItem: vi.fn(),
			moveBoardItem: vi.fn(),
			placeInventoryItem: vi.fn(),
			swapBoardItems: vi.fn(),
			storeBoardItem: vi.fn(),
			swapInventorySlots: vi.fn(),
		} satisfies DropActions;

		const outcome = resolveDrop({
			actions,
			config,
			board: emptyBoard,
			feedback,
			inventory: emptyInventory,
			context: {
				dragRect: rect,
				source: {
					boardItem: boardItem({
						id: "board-item",
						x: 0,
						y: 0,
					}),
					boardItemId: "board-item",
					itemId: "item:twig",
					kind: "board",
				} satisfies DragSource,
				sourceTile: {
					id: "board-item",
					slotId: "0:0",
					data: {},
				},
				target: {
					kind: "inventory",
				} satisfies DropTarget,
				targetRect: rect,
				targetSlot: null,
				targetTile: null,
			},
		});

		expect(outcome).toBe("reject");
		expect(actions.applyBoardItemToBoardItem).not.toHaveBeenCalled();
		expect(actions.moveBoardItem).not.toHaveBeenCalled();
	});

	it("marks cheat inventory deletes as consume animations without swap handoff", async () => {
		const deleteBoardItem = vi.fn(async () => undefined);
		const feedback = {
			pulseBoardCellFeedback: vi.fn(),
			showError: vi.fn(),
		} as unknown as Feedback.Type;
		const actions = {
			deleteBoardItem,
			applyBoardItemToBoardItem: vi.fn(),
			applyInventoryItemToBoardItem: vi.fn(),
			moveBoardItem: vi.fn(),
			placeInventoryItem: vi.fn(),
			swapBoardItems: vi.fn(),
			storeBoardItem: vi.fn(),
			swapInventorySlots: vi.fn(),
		} satisfies DropActions;
		const source = boardItem({
			id: "source",
			x: 0,
			y: 0,
		});
		const cheatTarget = {
			...boardItem({
				id: "cheat",
				x: 1,
				y: 0,
			}),
			itemId: cheatBoardItemId,
		} satisfies BoardViewItem;

		const outcome = resolveDrop({
			actions,
			config,
			feedback,
			inventory: emptyInventory,
			board: {
				...emptyBoard,
				byCellKey: {
					"0:0": source,
					"1:0": cheatTarget,
				},
				byId: {
					source,
					cheat: cheatTarget,
				},
			},
			context: {
				dragRect: rect,
				source: {
					kind: "board",
					boardItemId: source.id,
					itemId: source.itemId,
					boardItem: source,
				} satisfies DragSource,
				sourceTile: {
					id: source.id,
					slotId: "0:0",
					data: {},
				},
				target: {
					kind: "cell",
					x: cheatTarget.x,
					y: cheatTarget.y,
					boardItemId: cheatTarget.id,
				} satisfies DropTarget,
				targetRect: rect,
				targetSlot: {
					id: "1:0",
					data: {},
				},
				targetTile: {
					id: cheatTarget.id,
					slotId: "1:0",
					data: {},
				},
			},
		});

		expect(outcome).toMatchObject({
			animation: "consume",
			type: "accept",
		});

		if (typeof outcome !== "string" && outcome.type === "accept") {
			await outcome.commit?.();
		}

		expect(deleteBoardItem).toHaveBeenCalledWith({
			boardItemId: "source",
			expectedItemId: "item:twig",
		});
		expect(feedback.pulseBoardCellFeedback).toHaveBeenCalledWith("1:0", "danger");
	});

	it("marks board merges as immediate parallel merge commit animations", async () => {
		const applyBoardItemToBoardItem = vi.fn(async () => undefined);
		const feedback = {
			pulseMergeCell: vi.fn(),
			showError: vi.fn(),
		} as unknown as Feedback.Type;
		const actions = {
			deleteBoardItem: vi.fn(),
			applyBoardItemToBoardItem,
			applyInventoryItemToBoardItem: vi.fn(),
			moveBoardItem: vi.fn(),
			placeInventoryItem: vi.fn(),
			swapBoardItems: vi.fn(),
			storeBoardItem: vi.fn(),
			swapInventorySlots: vi.fn(),
		} satisfies DropActions;

		const outcome = resolveDrop({
			actions,
			config,
			feedback,
			inventory: emptyInventory,
			board: {
				...emptyBoard,
				byCellKey: {
					"0:0": boardItem({
						id: "source",
						x: 0,
						y: 0,
					}),
					"1:0": boardItem({
						id: "target",
						x: 1,
						y: 0,
					}),
				},
				byId: {
					source: boardItem({
						id: "source",
						x: 0,
						y: 0,
					}),
					target: boardItem({
						id: "target",
						x: 1,
						y: 0,
					}),
				},
			},
			context: {
				dragRect: rect,
				source: {
					kind: "board",
					boardItemId: "source",
					itemId: "item:twig",
					boardItem: boardItem({
						id: "source",
						x: 0,
						y: 0,
					}),
				} satisfies DragSource,
				sourceTile: {
					id: "source",
					slotId: "0:0",
					data: {},
				},
				target: {
					kind: "cell",
					x: 1,
					y: 0,
					boardItemId: "target",
				} satisfies DropTarget,
				targetRect: rect,
				targetSlot: {
					id: "1:0",
					data: {},
				},
				targetTile: {
					id: "target",
					slotId: "1:0",
					data: {},
				},
			},
		});

		expect(outcome).toMatchObject({
			animation: "parallel-merge",
			type: "accept",
		});

		if (typeof outcome !== "string" && outcome.type === "accept") {
			await outcome.commit?.();
		}

		expect(applyBoardItemToBoardItem).toHaveBeenCalledWith({
			expectedSourceItemId: "item:twig",
			expectedTargetItemId: "item:twig",
			sourceBoardItemId: "source",
			targetBoardItemId: "target",
		});
	});
});
