import { describe, expect, it } from "vitest";

import { InputRunPlanSchema } from "~/v1/input/schema/run/InputRunPlanSchema";

describe("InputRunPlanSchema", () => {
	it("accepts a simple run plan", () => {
		expect(
			InputRunPlanSchema.parse({
				type: "simple",
			}),
		).toEqual({
			type: "simple",
		});
	});

	it("accepts an ordered material allocation", () => {
		expect(
			InputRunPlanSchema.parse({
				type: "materials",
				mode: "reserve",
				quantity: 3,
				item: [
					{
						itemId: "runtime:water:a",
						quantity: 2,
					},
					{
						itemId: "runtime:water:b",
						quantity: 1,
					},
				],
			}),
		).toMatchObject({
			type: "materials",
			quantity: 3,
		});
	});

	it("rejects a material plan without a concrete allocation", () => {
		expect(() => {
			InputRunPlanSchema.parse({
				type: "materials",
				mode: "consume",
				quantity: 1,
				item: [],
			});
		}).toThrow();
	});
});
