import { describe, expect, it } from "vitest";
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

const inventorySource = (slotIndex: number) =>
	({
		kind: "inventory",
		slotIndex,
		itemId: "item:twig",
		slot: inventory.bySlotIndex[String(slotIndex)]!,
	}) satisfies DragSource;

describe("resolveInventoryCellDropAction", () => {
	it("rejects occupied board cells", () => {
		expect(
			resolveInventoryCellDropAction({
				inventory,
				source: inventorySource(0),
				target: {
					kind: "cell",
					x: 2,
					y: 1,
					boardItemId: "board-item",
				},
			}),
		).toEqual({
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: "2:1",
			},
		});
	});

	it("rejects empty inventory sources", () => {
		expect(
			resolveInventoryCellDropAction({
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
