import { describe, expect, it } from "vitest";

import { RuntimeMultiplierSchema } from "~/engine/line/schema/rule/RuntimeMultiplierSchema";

describe("RuntimeMultiplierSchema", () => {
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

		expect(RuntimeMultiplierSchema.safeParse(rule).success).toBe(true);
		expect(
			RuntimeMultiplierSchema.safeParse({
				...rule,
				multiplier: 0,
			}).success,
		).toBe(false);
	});
});
