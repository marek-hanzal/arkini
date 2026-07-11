import { describe, expect, it } from "vitest";

import { RuleRuntimeMultiplierSchema } from "~/v1/line/schema/rule/RuleRuntimeMultiplierSchema";

describe("RuleRuntimeMultiplierSchema", () => {
	it("requires a positive runtime multiplier", () => {
		const rule = {
			type: "runtime:multiplier",
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
			multiplier: 2,
		};

		expect(RuleRuntimeMultiplierSchema.safeParse(rule).success).toBe(true);
		expect(
			RuleRuntimeMultiplierSchema.safeParse({
				...rule,
				multiplier: 0,
			}).success,
		).toBe(false);
	});
});
