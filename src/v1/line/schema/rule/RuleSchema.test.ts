import { describe, expect, it } from "vitest";

import { RuleSchema } from "./RuleSchema";

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

	it("rejects the replaced line block discriminator", () => {
		expect(
			RuleSchema.safeParse({
				type: "block",
				when,
			}).success,
		).toBe(false);
	});
});
