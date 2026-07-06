import { describe, expect, it } from "vitest";
import { readDetailLineOutputRows } from "~/item-detail/ui/readDetailLineOutputRows";

describe("readDetailLineOutputRows", () => {
	it("groups repeated item outputs into one row", () => {
		const rows = readDetailLineOutputRows([
			{
				itemId: "item:stone",
				kind: "guaranteed",
				ownedQuantity: 2,
				quantity: 1,
			},
			{
				itemId: "item:stone",
				kind: "chance",
				ownedQuantity: 2,
				probability: 0.4,
				quantity: 1,
			},
			{
				itemId: "item:stone",
				kind: "chance",
				ownedQuantity: 2,
				probability: 0.15,
				quantity: 1,
			},
		]);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.itemId).toBe("item:stone");
		expect(rows[0]?.metaBadges.map((badge) => badge.label)).toEqual([
			"1× · guaranteed",
			"1× · 40% chance",
			"1× · 15% chance",
			"Owned 2",
		]);
	});

	it("keeps disabled outputs readable", () => {
		const rows = readDetailLineOutputRows([
			{
				enabled: false,
				itemId: "item:grain",
				kind: "guaranteed",
				ownedQuantity: 0,
				probability: 0,
				quantity: 1,
			},
		]);

		expect(rows[0]?.metaBadges.map((badge) => badge.label)).toEqual([
			"disabled · 1× · 0% chance",
			"Owned 0",
		]);
		expect(rows[0]?.metaBadges[0]?.one).toBe("warn");
	});

	it("keeps output bonus lines with their output row", () => {
		const rows = readDetailLineOutputRows([
			{
				bonusLines: [
					"Speed: 10% faster",
				],
				itemId: "item:stone",
				kind: "guaranteed",
				ownedQuantity: 2,
				quantity: 1,
			},
			{
				bonusLines: [
					"Speed: 10% faster",
					"Drop: 25% chance for +1×",
				],
				itemId: "item:stone",
				kind: "chance",
				ownedQuantity: 2,
				probability: 0.25,
				quantity: 1,
			},
		]);

		expect(rows[0]?.effectLines).toEqual([
			"Speed: 10% faster",
			"Drop: 25% chance for +1×",
		]);
	});
});
