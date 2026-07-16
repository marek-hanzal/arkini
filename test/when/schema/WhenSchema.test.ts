import { describe, expect, it } from "vitest";

import { WhenSchema } from "~/engine/when/schema/WhenSchema";

const inventoryQuery = {
	scope: "inventory",
	selector: {
		type: "tag",
		tag: "food",
	},
} as const;

const boardQuery = {
	scope: "board",
	distance: "near",
	selector: {
		type: "item",
		itemId: "item:pollution",
	},
} as const;

describe("WhenSchema", () => {
	it("accepts an existence condition without quantity fields", () => {
		expect(
			WhenSchema.safeParse({
				type: "exists",
				query: inventoryQuery,
			}).success,
		).toBe(true);
		expect(
			WhenSchema.safeParse({
				type: "exists",
				query: inventoryQuery,
				count: 1,
			}).success,
		).toBe(false);
	});

	it("accepts an exact non-negative count condition", () => {
		for (const count of [
			0,
			2,
		]) {
			expect(
				WhenSchema.safeParse({
					type: "count",
					query: inventoryQuery,
					count,
				}).success,
			).toBe(true);
		}
		expect(
			WhenSchema.safeParse({
				type: "count",
				query: inventoryQuery,
				count: -1,
			}).success,
		).toBe(false);
	});

	it("accepts an inclusive non-negative range", () => {
		expect(
			WhenSchema.safeParse({
				type: "range",
				query: inventoryQuery,
				min: 0,
				max: 2,
			}).success,
		).toBe(true);
		expect(
			WhenSchema.safeParse({
				type: "range",
				query: inventoryQuery,
				min: 3,
				max: 2,
			}).success,
		).toBe(false);
	});

	it("keeps board distance inside the query for every condition kind", () => {
		expect(
			WhenSchema.safeParse({
				type: "exists",
				query: boardQuery,
			}).success,
		).toBe(true);
		expect(
			WhenSchema.safeParse({
				type: "count",
				query: boardQuery,
				count: 1,
			}).success,
		).toBe(true);
		expect(
			WhenSchema.safeParse({
				type: "range",
				query: boardQuery,
				min: 1,
				max: 3,
			}).success,
		).toBe(true);
	});
});
