import { describe, expect, it } from "vitest";

import { RulesResultSchema } from "./RulesResultSchema";

describe("drop RulesResultSchema", () => {
	it("accepts an intentionally possibly empty ordered rule result collection", () => {
		expect(RulesResultSchema.safeParse([]).success).toBe(true);
		expect(
			RulesResultSchema.safeParse([
				{
					active: true,
					type: "enable",
				},
				{
					active: false,
					type: "disable",
				},
			]).success,
		).toBe(true);
		expect(
			RulesResultSchema.safeParse([
				{
					type: "disable",
				},
			]).success,
		).toBe(false);
	});
});
