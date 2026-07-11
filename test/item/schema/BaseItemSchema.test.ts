import { describe, expect, it } from "vitest";

import { BaseItemSchema } from "~/v1/item/schema/BaseItemSchema";
import { SimpleItemSchema } from "~/v1/item/schema/SimpleItemSchema";

describe("BaseItemSchema", () => {
	it("requires presentation, storage scope, and permits an optional positive total limit", () => {
		const item = {
			id: "tree",
			title: "Tree",
			description: "A living tree.",
			asset: {
				source: [
					"asset:tree",
				],
			},
			tags: [
				"nature",
			],
			categoryId: "resource",
			scope: "board",
			maxStackSize: 1,
		};

		expect(BaseItemSchema.safeParse(item).success).toBe(true);
		expect(
			BaseItemSchema.safeParse({
				...item,
				maxCount: 0,
			}).success,
		).toBe(false);
		expect(
			BaseItemSchema.safeParse({
				...item,
				maxStackSize: 0,
			}).success,
		).toBe(false);
		expect(
			BaseItemSchema.safeParse({
				...item,
				title: "",
			}).success,
		).toBe(false);
		expect(
			BaseItemSchema.safeParse({
				...item,
				tags: undefined,
			}).success,
		).toBe(false);
		expect(
			BaseItemSchema.safeParse({
				...item,
				categoryId: undefined,
			}).success,
		).toBe(false);
		expect(
			BaseItemSchema.safeParse({
				...item,
				merge: [],
			}).success,
		).toBe(false);
		expect(
			BaseItemSchema.safeParse({
				...item,
				merge: [
					{
						target: {
							type: "item",
							itemId: "tree",
						},
						action: "consume",
						effect: "replace",
						result: "tree",
					},
				],
			}).success,
		).toBe(true);
	});

	it("inherits the base stack limit for simple items", () => {
		const item = {
			id: "tree",
			title: "Tree",
			description: "A living tree.",
			asset: {
				source: [
					"asset:tree",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "board",
			type: "simple",
			maxStackSize: 1,
		};

		expect(SimpleItemSchema.safeParse(item).success).toBe(true);
		expect(
			SimpleItemSchema.safeParse({
				...item,
				maxStackSize: 0,
			}).success,
		).toBe(false);
	});
});
