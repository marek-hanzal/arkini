import { describe, expect, it } from "vitest";

import { MemoryItemSchema } from "./MemoryItemSchema";

const item = {
	id: "item:memory",
	type: "memory",
	title: "Memory",
	description: "Stores and restores one board layout snapshot.",
	asset: {
		source: [
			"asset:item:memory:empty",
			"asset:item:memory:full",
		],
	},
	tags: [
		"utility",
	],
	categoryId: "utility",
};

describe("MemoryItemSchema", () => {
	it("defaults memories to individual board-or-inventory items", () => {
		expect(MemoryItemSchema.parse(item)).toMatchObject({
			maxStackSize: 1,
			scope: "any",
		});
	});

	it("rejects restricted storage and stacking", () => {
		for (const override of [
			{
				scope: "board",
			},
			{
				maxStackSize: 2,
			},
		]) {
			expect(
				MemoryItemSchema.safeParse({
					...item,
					...override,
				}).success,
			).toBe(false);
		}
	});

	it("rejects any asset count other than two", () => {
		for (const source of [
			[
				"asset:item:memory:empty",
			],
			[
				"asset:item:memory:empty",
				"asset:item:memory:full",
				"asset:item:memory:extra",
			],
		]) {
			expect(
				MemoryItemSchema.safeParse({
					...item,
					asset: {
						source,
					},
				}).success,
			).toBe(false);
		}
	});
});
