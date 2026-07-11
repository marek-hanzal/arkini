import { describe, expect, it } from "vitest";

import { DropResultsSchema } from "./DropResultsSchema";

const result = {
	itemId: "item:log",
	placement: "drop" as const,
	quantity: 2,
};

describe("DropResultsSchema", () => {
	it("accepts an intentionally empty result", () => {
		expect(DropResultsSchema.safeParse([]).success).toBe(true);
	});

	it("accepts exactly one resolved drop", () => {
		expect(
			DropResultsSchema.safeParse([
				result,
			]).success,
		).toBe(true);
	});

	it("rejects more than one resolved drop", () => {
		expect(
			DropResultsSchema.safeParse([
				result,
				result,
			]).success,
		).toBe(false);
	});
});
