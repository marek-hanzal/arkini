import { describe, expect, it } from "vitest";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
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
			state: {},
			stateJson: "{}",
			stateful: false,
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

	it("places inventory items into empty board cells", () => {
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
			type: "place-inventory-item",
			input: {
				slotIndex: 0,
				x: 2,
				y: 1,
			},
		});
	});
});
