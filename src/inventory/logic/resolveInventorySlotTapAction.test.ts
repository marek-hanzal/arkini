import { describe, expect, it } from "vitest";
import { resolveInventorySlotTapAction } from "~/inventory/logic/resolveInventorySlotTapAction";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";

const slot = (overrides: Partial<InventorySlot> = {}): InventorySlot => ({
	slotIndex: 2,
	...overrides,
});

const stack = (): NonNullable<InventorySlot["stack"]> => ({
	id: "stack:twig",
	itemId: "item:twig",
	quantity: 1,
});

describe("resolveInventorySlotTapAction", () => {
	it("places filled inventory slots onto the first empty board cell", () => {
		expect(
			resolveInventorySlotTapAction({
				firstEmptyCell: {
					x: 3,
					y: 4,
				},
				slot: slot({
					stack: stack(),
				}),
			}),
		).toEqual({
			slotIndex: 2,
			type: "place-on-board",
			x: 3,
			y: 4,
		});
	});

	it("flashes empty inventory slots", () => {
		expect(
			resolveInventorySlotTapAction({
				firstEmptyCell: {
					x: 3,
					y: 4,
				},
				slot: slot(),
			}),
		).toEqual({
			slotIndex: 2,
			type: "flash-inventory-slot",
		});
	});

	it("flashes filled slots when the board has no empty cell", () => {
		expect(
			resolveInventorySlotTapAction({
				firstEmptyCell: undefined,
				slot: slot({
					stack: stack(),
				}),
			}),
		).toEqual({
			slotIndex: 2,
			type: "flash-inventory-slot",
		});
	});
});
