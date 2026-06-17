import { describe, expect, it } from "vitest";
import { rebuildInventoryView } from "~/v0/inventory/view/rebuildInventoryView";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { applyInventoryVisualEvent } from "~/v0/play/cache/applyInventoryVisualEvent";

describe("applyInventoryVisualEvent", () => {
	it("applies inventory quantity changes and preserves matching stack identity", () => {
		const inventory = rebuildInventoryView([
			{
				slotIndex: 0,
				stack: {
					id: "stack-1",
					itemId: "item:twig",
					quantity: 4,
					state: {},
					stateJson: "{}",
					stateful: false,
				},
			},
		]);
		const event = {
			itemId: "item:twig",
			nextQuantity: 1,
			previousQuantity: 4,
			quantity: 3,
			reason: "product-input",
			slotIndex: 0,
			type: "inventory.quantity_changed",
		} satisfies ActionVisualEventSchema.Type;

		const next = applyInventoryVisualEvent(inventory, event);

		expect(next.bySlotIndex["0"]?.stack).toMatchObject({
			id: "stack-1",
			itemId: "item:twig",
			quantity: 1,
		});
	});

	it("clears a slot when an inventory quantity change reaches zero", () => {
		const inventory = rebuildInventoryView([
			{
				slotIndex: 0,
				stack: {
					id: "stack-1",
					itemId: "item:twig",
					quantity: 1,
					state: {},
					stateJson: "{}",
					stateful: false,
				},
			},
		]);
		const event = {
			itemId: "item:twig",
			nextQuantity: 0,
			previousQuantity: 1,
			quantity: 1,
			reason: "merge-source",
			slotIndex: 0,
			type: "inventory.quantity_changed",
		} satisfies ActionVisualEventSchema.Type;

		const next = applyInventoryVisualEvent(inventory, event);

		expect(next.bySlotIndex["0"]?.stack).toBeUndefined();
	});
});
