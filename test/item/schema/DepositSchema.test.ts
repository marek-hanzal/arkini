import { describe, expect, it } from "vitest";

import { DepositSchema } from "~/engine/item/schema/DepositSchema";

describe("DepositSchema", () => {
	it("accepts the shared positive item charge contract", () => {
		const item = {
			uid: "deposit:tree",
			id: "deposit:tree",
			title: "Tree",
			description: "A finite tree.",
			asset: {
				default: [
					"asset:tree",
				],
			},
			scope: "board",
			maxStackSize: 1,
			type: "deposit",
			charges: {
				amount: 3,
			},
		};

		expect(DepositSchema.safeParse(item).success).toBe(true);
		expect(
			DepositSchema.safeParse({
				...item,
				charges: {
					amount: 0,
				},
			}).success,
		).toBe(false);
	});

	it("accepts optional production lines on a finite deposit", () => {
		const result = DepositSchema.parse({
			uid: "deposit:well",
			id: "deposit:well",
			title: "Well",
			description: "A finite self-consuming well.",
			asset: {
				default: [
					"asset:well",
				],
			},
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
