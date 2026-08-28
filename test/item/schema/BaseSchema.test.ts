import { describe, expect, it } from "vitest";

import { BaseSchema } from "~/engine/item/schema/BaseSchema";
import { SimpleSchema } from "~/engine/item/schema/SimpleSchema";

describe("BaseSchema", () => {
	it("requires immutable identity, presentation, storage scope, and permits an optional positive total limit", () => {
		const item = {
			uid: "tree",
			id: "tree",
			title: "Tree",
			description: "A living tree.",
			asset: {
				default: [
					"asset:tree",
				],
			},
			scope: "board",
			maxStackSize: 1,
		};

		expect(BaseSchema.safeParse(item).success).toBe(true);
		expect(
			BaseSchema.safeParse({
				...item,
				uid: undefined,
			}).success,
		).toBe(false);
		expect(
			BaseSchema.safeParse({
				...item,
				maxCount: 0,
			}).success,
		).toBe(false);
		expect(
			BaseSchema.safeParse({
				...item,
				maxStackSize: 0,
			}).success,
		).toBe(false);
		expect(
			BaseSchema.safeParse({
				...item,
				title: "",
			}).success,
		).toBe(false);
		expect(
			BaseSchema.safeParse({
				...item,
				merge: [],
			}).success,
		).toBe(false);
		expect(
			BaseSchema.safeParse({
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
			uid: "tree",
			id: "tree",
			title: "Tree",
			description: "A living tree.",
			asset: {
				default: [
					"asset:tree",
				],
			},
			scope: "board",
			type: "simple",
			maxStackSize: 1,
		};

		expect(SimpleSchema.safeParse(item).success).toBe(true);
		expect(
			SimpleSchema.safeParse({
				...item,
				maxStackSize: 0,
			}).success,
		).toBe(false);
	});
});
