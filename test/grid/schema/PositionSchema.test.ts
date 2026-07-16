import { describe, expect, it } from "vitest";

import { PositionSchema } from "~/engine/grid/schema/PositionSchema";

describe("PositionSchema", () => {
	it("accepts only zero-based non-negative integer coordinates", () => {
		expect(
			PositionSchema.safeParse({
				x: 0,
				y: 2,
			}).success,
		).toBe(true);
		expect(
			PositionSchema.safeParse({
				x: -1,
				y: 2,
			}).success,
		).toBe(false);
	});
});
