import { describe, expect, it } from "vitest";

import { RuleResultSchema } from "./RuleResultSchema";

describe("drop RuleResultSchema", () => {
	it("discriminates enable and disable evaluation results", () => {
		for (const type of [
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
				type: "enable",
			}).success,
		).toBe(false);
	});
});
