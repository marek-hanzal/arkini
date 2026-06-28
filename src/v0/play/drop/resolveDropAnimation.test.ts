import { describe, expect, it, vi } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { resolveDrop } from "~/v0/play/drop/resolveDrop";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { DropActions } from "~/v0/play/drop/DropActions";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

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
			applyBoardItemToBoardItem: vi.fn(),
			applyInventoryItemToBoardItem: vi.fn(),
			moveBoardItem: vi.fn(),
			placeInventoryItem: vi.fn(),
			swapBoardItems: vi.fn(),
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
			sourceSlotIndex: 0,
			targetSlotIndex: 1,
		});
	});

	it("rejects board item drops onto the inventory target", () => {
		const feedback = {
			showError: vi.fn(),
		} as unknown as Feedback.Type;
		const actions = {
			applyBoardItemToBoardItem: vi.fn(),
			applyInventoryItemToBoardItem: vi.fn(),
			moveBoardItem: vi.fn(),
			placeInventoryItem: vi.fn(),
			swapBoardItems: vi.fn(),
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

	it("marks board merges as immediate parallel merge commit animations", async () => {
		const applyBoardItemToBoardItem = vi.fn(async () => undefined);
		const feedback = {
			pulseMergeCell: vi.fn(),
			showError: vi.fn(),
		} as unknown as Feedback.Type;
		const actions = {
			applyBoardItemToBoardItem,
			applyInventoryItemToBoardItem: vi.fn(),
			moveBoardItem: vi.fn(),
			placeInventoryItem: vi.fn(),
			swapBoardItems: vi.fn(),
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
			sourceBoardItemId: "source",
			targetBoardItemId: "target",
		});
	});
});
