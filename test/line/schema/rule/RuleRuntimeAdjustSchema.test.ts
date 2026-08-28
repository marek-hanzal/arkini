import { describe, expect, it } from "vitest";

import { RuleRuntimeAdjustSchema } from "~/engine/line/schema/rule/RuleRuntimeAdjustSchema";

describe("RuleRuntimeAdjustSchema", () => {
	it("accepts positive, negative, and zero whole-millisecond adjustments", () => {
		const rule = {
			type: "runtime:adjust",
			when: [
				{
					type: "exists",
					query: {
						scope: "board",
						distance: "close",
						selector: {
							type: "item",
							itemId: "pollution",
						},
					},
				},
			],
			adjustMs: 1_000,
		} as const;

		for (const adjustMs of [
			-1_000,
			0,
			1_000,
		]) {
			expect(
				RuleRuntimeAdjustSchema.safeParse({
					...rule,
					adjustMs,
				}).success,
			).toBe(true);
		}
		expect(
			RuleRuntimeAdjustSchema.safeParse({
				...rule,
				adjustMs: 0.5,
			}).success,
		).toBe(false);
	});
});
