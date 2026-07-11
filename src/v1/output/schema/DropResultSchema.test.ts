import { describe, expect, it } from "vitest";

import { DropResultSchema } from "./DropResultSchema";

describe("DropResultSchema", () => {
	it("accepts only a concrete resolved quantity and placement", () => {
		expect(
			DropResultSchema.safeParse({
				itemId: "item:log",
				placement: "drop",
				quantity: 2,
			}).success,
		).toBe(true);
		expect(
			DropResultSchema.safeParse({
				itemId: "item:log",
				placement: "drop",
				quantity: {
					type: "value",
					value: 2,
				},
			}).success,
		).toBe(false);
	});
});
