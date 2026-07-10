import { describe, expect, it } from "vitest";

import { DropSchema } from "./DropSchema";

describe("DropSchema", () => {
	it("defaults resolved drops to the local board-placement strategy", () => {
		const drop = DropSchema.parse({
			itemId: "item:log",
			quantity: {
				type: "value",
				value: 1,
			},
			rules: [],
		});

		expect(drop.placement).toBe("drop");
	});

	it("accepts explicit random and replace placement", () => {
		for (const placement of [
			"random",
			"replace",
		]) {
			expect(
				DropSchema.safeParse({
					itemId: "item:log",
					quantity: {
						type: "value",
						value: 1,
					},
					placement,
					rules: [],
				}).success,
			).toBe(true);
		}
		expect(
			DropSchema.safeParse({
				itemId: "item:log",
				quantity: {
					type: "value",
					value: 1,
				},
				placement: "anywhere",
				rules: [],
			}).success,
		).toBe(false);
	});
});
