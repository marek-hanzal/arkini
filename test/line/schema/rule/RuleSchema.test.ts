import { describe, expect, it } from "vitest";

import { RuleSchema } from "~/v1/line/schema/rule/RuleSchema";

const when = [
	{
		type: "exists" as const,
		query: {
			scope: "any" as const,
			selector: {
				type: "item" as const,
				itemId: "item:permit",
			},
		},
	},
];

describe("line RuleSchema", () => {
	it("accepts symmetric enable and disable rules", () => {
		for (const type of [
			"enable",
			"disable",
		] as const) {
			expect(
				RuleSchema.safeParse({
					type,
					when,
				}).success,
			).toBe(true);
		}
	});

	it("rejects the replaced require and block discriminators", () => {
		for (const type of [
			"require",
			"block",
		] as const) {
			expect(
				RuleSchema.safeParse({
					type,
					when,
				}).success,
			).toBe(false);
		}
	});
});
