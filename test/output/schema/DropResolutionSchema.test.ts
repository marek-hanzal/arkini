import { describe, expect, it } from "vitest";

import { DropResolutionSchema } from "~/v1/output/schema/DropResolutionSchema";

const result = {
	itemId: "item:log",
	placement: "drop" as const,
	quantity: 2,
};

describe("DropResolutionSchema", () => {
	it("accepts an intentionally absent result", () => {
		expect(DropResolutionSchema.safeParse(undefined).success).toBe(true);
	});

	it("accepts one resolved drop", () => {
		expect(DropResolutionSchema.safeParse(result).success).toBe(true);
	});

	it("rejects collection-shaped results", () => {
		expect(DropResolutionSchema.safeParse([]).success).toBe(false);
		expect(
			DropResolutionSchema.safeParse([
				result,
			]).success,
		).toBe(false);
	});
});
