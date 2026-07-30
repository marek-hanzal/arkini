import { describe, expect, it } from "vitest";

import { DepositItemSchema } from "~/engine/item/schema/DepositItemSchema";

describe("DepositItemSchema", () => {
	it("accepts the shared positive item charge contract", () => {
		const item = {
			id: "deposit:tree",
			title: "Tree",
			description: "A finite tree.",
			asset: {
				default: [
					"asset:tree",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "board",
			maxStackSize: 1,
			type: "deposit",
			charges: {
				amount: 3,
			},
		};

		expect(DepositItemSchema.safeParse(item).success).toBe(true);
		expect(
			DepositItemSchema.safeParse({
				...item,
				charges: {
					amount: 0,
				},
			}).success,
		).toBe(false);
	});

	it("accepts optional production lines on a finite deposit", () => {
		const result = DepositItemSchema.parse({
			id: "deposit:well",
			title: "Well",
			description: "A finite self-consuming well.",
			asset: {
				default: [
					"asset:well",
				],
			},
			tags: [],
			categoryId: "building",
			scope: "board",
			maxStackSize: 1,
			type: "deposit",
			charges: {
				amount: 30,
			},
			lines: [
				{
					id: "line:well:water",
					title: "Water",
					description: "Draw water.",
					runtimeMs: 1,
					input: [
						{
							type: "deposit",
							query: {
								scope: "board",
								distance: "self",
								selector: {
									type: "item",
									itemId: "deposit:well",
								},
							},
							charges: {
								from: "target",
								cost: 1,
							},
						},
					],
					rules: [],
				},
			],
		});

		expect(result.maxQueueSize).toBe(1);
		expect(result.lines).toHaveLength(1);
	});
});
