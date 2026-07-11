import { describe, expect, it } from "vitest";

import { OutputResultSchema } from "./OutputResultSchema";

describe("OutputResultSchema", () => {
	it("accepts an intentionally empty resolved output", () => {
		expect(
			OutputResultSchema.safeParse({
				drop: [],
			}).success,
		).toBe(true);
	});

	it("accepts concrete resolved drops and rejects unresolved quantities", () => {
		expect(
			OutputResultSchema.safeParse({
				drop: [
					{
						itemId: "item:log",
						placement: "drop",
						quantity: 2,
					},
				],
			}).success,
		).toBe(true);
		expect(
			OutputResultSchema.safeParse({
				drop: [
					{
						itemId: "item:log",
						placement: "drop",
						quantity: {
							type: "value",
							value: 2,
						},
					},
				],
			}).success,
		).toBe(false);
	});
});
