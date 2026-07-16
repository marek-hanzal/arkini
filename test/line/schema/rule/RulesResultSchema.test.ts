import { describe, expect, it } from "vitest";

import { RulesResultSchema } from "~/engine/line/schema/rule/RulesResultSchema";

describe("line RulesResultSchema", () => {
	it("accepts an intentionally possibly empty ordered rule result collection", () => {
		expect(RulesResultSchema.safeParse([]).success).toBe(true);
		expect(
			RulesResultSchema.safeParse([
				{
					active: true,
					type: "show",
				},
				{
					active: false,
					multiplier: 1.5,
					type: "runtime:multiplier",
				},
			]).success,
		).toBe(true);
		expect(
			RulesResultSchema.safeParse([
				{
					type: "enable",
				},
			]).success,
		).toBe(false);
	});
});
