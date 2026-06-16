import { describe, expect, it } from "vitest";
import type { DragSource } from "~/v0/play/drag/DragSource";
import { resolveInventorySlotDropAction } from "~/v0/play/drop/resolveInventorySlotDropAction";

const source = (slotIndex: number) =>
	({
		kind: "inventory",
		slotIndex,
		itemId: "item:twig",
		slot: {} as never,
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
