import { describe, expect, it } from "vitest";

import { InventoryItemSchema } from "~/engine/item/schema/InventoryItemSchema";

const item = {
	id: "item:inventory",
	type: "inventory",
	title: "Backpack",
	description: "Opens the shared inventory from the board.",
	asset: {
		source: [
			"asset:item:inventory",
		],
	},
	tags: [
		"utility",
	],
	categoryId: "utility",
};

describe("InventoryItemSchema", () => {
	it("fixes inventory openers to one board-only singleton", () => {
		expect(InventoryItemSchema.parse(item)).toMatchObject({
			maxCount: 1,
			maxStackSize: 1,
			scope: "board",
		});
	});

	it("rejects storage and quantity overrides", () => {
		for (const override of [
			{
				scope: "any",
			},
			{
				maxCount: 2,
			},
			{
				maxStackSize: 2,
			},
		]) {
			expect(
				InventoryItemSchema.safeParse({
					...item,
					...override,
				}).success,
			).toBe(false);
		}
	});
});
