import { describe, expect, it } from "vitest";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { createEngineMergeTestConfig } from "~/v0/game/engine/test/createEngineMergeTestConfig";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";
import type { DragSource } from "~/v0/play/drag/DragSource";
import { resolveInventoryCellDropAction } from "~/v0/play/drop/resolveInventoryCellDropAction";

const inventory = rebuildInventoryView([
	{
		slotIndex: 0,
		stack: {
			id: "stack-0",
			itemId: "item:twig",
			quantity: 2,
		},
	},
	{
		slotIndex: 1,
	},
]);

const board = rebuildBoardView([
	{
		id: "merge-target",
		itemId: "item:twig",
		state: {},
		x: 2,
		y: 1,
	},
	{
		id: "blocked-target",
		itemId: "item:branch",
		state: {},
		x: 3,
		y: 1,
	},
]);

const inventorySource = (slotIndex: number) =>
	({
		kind: "inventory",
		slotIndex,
		itemId: "item:twig",
		slot: inventory.bySlotIndex[String(slotIndex)]!,
	}) satisfies DragSource;

const config = createEngineTestConfig();

describe("resolveInventoryCellDropAction", () => {
	it("applies inventory items to occupied board cells when the target accepts the item", () => {
		expect(
			resolveInventoryCellDropAction({
				board,
				config,
				inventory,
				source: inventorySource(0),
				target: {
					kind: "cell",
					x: 2,
					y: 1,
					boardItemId: "merge-target",
				},
			}),
		).toEqual({
			type: "apply-inventory-item-to-board-item",
			input: {
				sourceSlotIndex: 0,
				targetBoardItemId: "merge-target",
			},
		});
	});

	it("uses the live target cell item instead of a stale empty target snapshot", () => {
		expect(
			resolveInventoryCellDropAction({
				board,
				config,
				inventory,
				source: inventorySource(0),
				target: {
					kind: "cell",
					x: 2,
					y: 1,
				},
			}),
		).toEqual({
			type: "apply-inventory-item-to-board-item",
			input: {
				sourceSlotIndex: 0,
				targetBoardItemId: "merge-target",
			},
		});
	});

	it("uses the live inventory stack item instead of a stale drag snapshot", () => {
		const liveInventory = rebuildInventoryView([
			{
				slotIndex: 0,
				stack: {
					id: "stack-0",
					itemId: "item:water",
					quantity: 1,
				},
			},
		]);

		expect(
			resolveInventoryCellDropAction({
				board,
				config: createEngineMergeTestConfig(),
				inventory: liveInventory,
				source: {
					kind: "inventory",
					slotIndex: 0,
					itemId: "item:twig",
					slot: liveInventory.bySlotIndex["0"]!,
				},
				target: {
					kind: "cell",
					x: 2,
					y: 1,
					boardItemId: "merge-target",
				},
			}),
		).toEqual({
			type: "apply-inventory-item-to-board-item",
			input: {
				sourceSlotIndex: 0,
				targetBoardItemId: "merge-target",
			},
		});
	});

	it("rejects occupied board cells that cannot accept the inventory item", () => {
		expect(
			resolveInventoryCellDropAction({
				board,
				config,
				inventory,
				source: inventorySource(0),
				target: {
					kind: "cell",
					x: 3,
					y: 1,
					boardItemId: "blocked-target",
				},
			}),
		).toEqual({
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: "3:1",
			},
		});
	});

	it("rejects empty inventory sources", () => {
		expect(
			resolveInventoryCellDropAction({
				board,
				config,
				inventory,
				source: inventorySource(1),
				target: {
					kind: "cell",
					x: 2,
					y: 1,
				},
			}),
		).toEqual({
			type: "reject",
			feedback: {
				kind: "inventory-slot",
				slotIndex: 1,
			},
		});
	});

	it("places inventory items into live empty board cells", () => {
		expect(
			resolveInventoryCellDropAction({
				board,
				config,
				inventory,
				source: inventorySource(0),
				target: {
					kind: "cell",
					x: 4,
					y: 1,
				},
			}),
		).toEqual({
			type: "place-inventory-item",
			input: {
				slotIndex: 0,
				x: 4,
				y: 1,
			},
		});
	});

	it("applies inventory items to stored requirement slots", () => {
		const targetBoard = rebuildBoardView([
			{
				id: "requirement-target",
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
			},
		]);

		expect(
			resolveInventoryCellDropAction({
				board: targetBoard,
				config,
				inventory,
				source: inventorySource(0),
				target: {
					kind: "cell",
					x: 1,
					y: 0,
					boardItemId: "requirement-target",
				},
			}),
		).toEqual({
			type: "apply-inventory-item-to-board-item",
			feedback: {
				cellKey: "1:0",
				variant: "primary",
			},
			input: {
				sourceSlotIndex: 0,
				targetBoardItemId: "requirement-target",
			},
		});
	});
	it("applies inventory items to stash inputs", () => {
		const targetBoard = rebuildBoardView([
			{
				id: "stash-target",
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
					requirements: [],
					trigger: "click",
				},
			},
		]);

		expect(
			resolveInventoryCellDropAction({
				board: targetBoard,
				config,
				inventory,
				source: inventorySource(0),
				target: {
					kind: "cell",
					x: 1,
					y: 0,
					boardItemId: "stash-target",
				},
			}),
		).toEqual({
			type: "apply-inventory-item-to-board-item",
			feedback: {
				cellKey: "1:0",
				variant: "secondary",
			},
			input: {
				sourceSlotIndex: 0,
				targetBoardItemId: "stash-target",
			},
		});
	});
});
