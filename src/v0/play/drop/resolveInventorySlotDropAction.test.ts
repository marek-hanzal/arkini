import { describe, expect, it } from "vitest";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import { resolveInventorySlotDropAction } from "~/v0/play/drop/resolveInventorySlotDropAction";

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

describe("resolveInventorySlotDropAction", () => {
	it("ignores drops onto the same inventory slot", () => {
		expect(
			resolveInventorySlotDropAction({
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
				source: source(0),
				target: {
					kind: "inventory-slot",
					slotIndex: 2,
				},
			}),
		).toEqual({
			type: "swap-inventory-slots",
			animation: "parallel-swap",
			input: {
				sourceSlotIndex: 0,
				targetSlotIndex: 2,
			},
		});
	});
});
