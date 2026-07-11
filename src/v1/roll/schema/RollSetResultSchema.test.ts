import { describe, expect, it } from "vitest";

import { RollSetResultSchema } from "./RollSetResultSchema";

describe("RollSetResultSchema", () => {
	it("accepts an intentionally empty aggregation", () => {
		expect(
			RollSetResultSchema.safeParse({
				drop: [],
			}).success,
		).toBe(true);
	});

	it("accepts unresolved drops aggregated from multiple rolls", () => {
		expect(
			RollSetResultSchema.safeParse({
				drop: [
					{
						itemId: "item:log",
						quantity: {
							type: "value",
							value: 1,
						},
						placement: "drop",
						rules: [],
					},
				],
			}).success,
		).toBe(true);
	});
});
