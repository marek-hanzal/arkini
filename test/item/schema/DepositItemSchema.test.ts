import { describe, expect, it } from "vitest";

import { DepositItemSchema } from "~/engine/item/schema/DepositItemSchema";

describe("DepositItemSchema", () => {
	it("accepts the shared positive item charge contract", () => {
		const item = {
			id: "deposit:tree",
			title: "Tree",
			description: "A finite tree.",
			asset: {
				source: [
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
});
