import { describe, expect, it } from "vitest";

import { InventorySchema } from "~/engine/item/schema/InventorySchema";

const item = {
	uid: "item:inventory",
	id: "item:inventory",
	type: "inventory",
	title: "Backpack",
	description: "Opens the shared inventory from the board.",
	asset: {
		default: [
			"asset:item:inventory",
		],
	},
};

describe("InventorySchema", () => {
	it("fixes inventory openers to one Board-default singleton", () => {
		expect(InventorySchema.parse(item)).toMatchObject({
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
				InventorySchema.safeParse({
					...item,
					...override,
				}).success,
			).toBe(false);
		}
	});
});
