import { describe, expect, it } from "vitest";

import { RuleResultSchema } from "~/engine/line/schema/rule/RuleResultSchema";

describe("line RuleResultSchema", () => {
	it("discriminates boolean and runtime multiplier results", () => {
		for (const type of [
			"show",
			"hide",
			"enable",
			"disable",
		] as const) {
			expect(
				RuleResultSchema.safeParse({
					active: true,
					type,
				}).success,
			).toBe(true);
		}

		expect(
			RuleResultSchema.safeParse({
				active: true,
				multiplier: 1.5,
				type: "runtime:multiplier",
			}).success,
		).toBe(true);
		expect(
			RuleResultSchema.safeParse({
				active: true,
				type: "runtime:multiplier",
			}).success,
		).toBe(false);
	});
});
