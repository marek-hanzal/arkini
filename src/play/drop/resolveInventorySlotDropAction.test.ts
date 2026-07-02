import { describe, expect, it } from "vitest";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/play/drag/DragSource";
import { resolveInventorySlotDropAction } from "~/play/drop/resolveInventorySlotDropAction";

const slot = (slotIndex: number) =>
	({
		slotIndex,
		stack: {
			id: `stack-${slotIndex}`,
			itemId: "item:twig",
			quantity: 1,
		},
	}) satisfies InventorySlot;

const source = (slotIndex: number) =>
	({
		kind: "inventory",
		itemId: "item:twig",
		slot: slot(slotIndex),
		slotIndex,
	}) satisfies DragSource;

const swapInput = (sourceSlotIndex: number, targetSlotIndex: number) => {
	const sourceStack = inventory.bySlotIndex[String(sourceSlotIndex)]!.stack!;
	const targetStack = inventory.bySlotIndex[String(targetSlotIndex)]?.stack;
	return {
		expectedSourceItemId: sourceStack.itemId,
		expectedSourceStackId: sourceStack.id,
		expectedTargetItemId: targetStack?.itemId,
		expectedTargetStackId: targetStack?.id,
		sourceSlotIndex,
		targetSlotIndex,
	};
};

const inventory = rebuildInventoryView([
	slot(0),
	{
		slotIndex: 1,
	},
	{
		slotIndex: 2,
		stack: {
			id: "stack-2",
			itemId: "item:pebble",
			quantity: 1,
		},
	},
]);

const staleInventory = rebuildInventoryView([
	{
		slotIndex: 0,
	},
	{
		slotIndex: 1,
	},
]);

describe("resolveInventorySlotDropAction", () => {
	it("ignores drops onto the same inventory slot", () => {
		expect(
			resolveInventorySlotDropAction({
				inventory,
				source: source(0),
				target: {
					kind: "inventory-slot",
					slotIndex: 0,
				},
			}),
		).toEqual({
			type: "ignore",
		});
	});

	it("swaps different inventory slots with parallel animation", () => {
		expect(
			resolveInventorySlotDropAction({
				inventory,
				source: source(0),
				target: {
					kind: "inventory-slot",
					slotIndex: 2,
				},
			}),
		).toEqual({
			type: "swap-inventory-slots",
			animation: "parallel-swap",
			input: swapInput(0, 2),
		});
	});

	it("rejects drops when the source inventory slot is stale", () => {
		expect(
			resolveInventorySlotDropAction({
				inventory: staleInventory,
				source: source(0),
				target: {
					kind: "inventory-slot",
					slotIndex: 2,
				},
			}),
		).toEqual({
			type: "reject",
		});
	});
});
