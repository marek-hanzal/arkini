import { describe, expect, it, vi } from "vitest";
import { resolveDrop } from "~/v0/play/drop/resolveDrop";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { DropActions } from "~/v0/play/drop/DropActions";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

const rect = {
	left: 0,
	top: 0,
	width: 64,
	height: 64,
} satisfies TileEngine.Rect;

describe("resolveDrop animation contract", () => {
	it("preserves parallel swap runtime animation when wrapping commits with error feedback", async () => {
		const swapInventorySlots = vi.fn(async () => undefined);
		const feedback = {
			showError: vi.fn(),
		} as unknown as Feedback.Type;
		const actions = {
			mergeBoardItems: vi.fn(),
			moveBoardItem: vi.fn(),
			placeInventoryItem: vi.fn(),
			stashBoardItem: vi.fn(),
			swapBoardItems: vi.fn(),
			swapInventorySlots,
		} satisfies DropActions;

		const outcome = resolveDrop({
			actions,
			board: {} as never,
			feedback,
			inventory: {} as never,
			context: {
				dragRect: rect,
				source: {
					kind: "inventory",
					itemId: "item:twig",
					slot: {} as never,
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

	it("marks board merges as immediate parallel merge cache animations", async () => {
		const mergeBoardItems = vi.fn(async () => undefined);
		const feedback = {
			pulseMergeCell: vi.fn(),
			showError: vi.fn(),
		} as unknown as Feedback.Type;
		const actions = {
			mergeBoardItems,
			moveBoardItem: vi.fn(),
			placeInventoryItem: vi.fn(),
			stashBoardItem: vi.fn(),
			swapBoardItems: vi.fn(),
			swapInventorySlots: vi.fn(),
		} satisfies DropActions;

		const outcome = resolveDrop({
			actions,
			feedback,
			inventory: {} as never,
			board: {
				byId: {
					target: {
						id: "target",
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
				},
			} as never,
			context: {
				dragRect: rect,
				source: {
					kind: "board",
					boardItemId: "source",
					itemId: "item:twig",
					boardItem: {} as never,
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

		expect(mergeBoardItems).toHaveBeenCalledWith({
			sourceBoardItemId: "source",
			targetBoardItemId: "target",
		});
	});
});
