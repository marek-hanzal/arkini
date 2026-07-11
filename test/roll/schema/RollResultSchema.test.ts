import { describe, expect, it } from "vitest";

import { RollResultSchema } from "~/v1/roll/schema/RollResultSchema";

describe("RollResultSchema", () => {
	it("intentionally accepts an empty result when a valid roll selects no drops", () => {
		// This is a runtime result rather than configured roll input. A failed chance
		// roll is valid and produces zero selected drops, so this must remain an array
		// instead of becoming a non-empty tuple like configured drop collections.
		expect(
			RollResultSchema.safeParse({
				drop: [],
			}).success,
		).toBe(true);
	});

	it("accepts unresolved drops selected by a successful roll", () => {
		expect(
			RollResultSchema.safeParse({
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
