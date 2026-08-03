import { describe, expect, it } from "vitest";

import { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

describe("QuantitySchema", () => {
	it("accepts equal bounds as one fixed quantity", () => {
		expect(
			QuantitySchema.parse({
				min: 3,
				max: 3,
			}),
		).toEqual({
			min: 3,
			max: 3,
		});
	});

	it("accepts one inclusive quantity range", () => {
		expect(
			QuantitySchema.parse({
				min: 2,
				max: 5,
			}),
		).toEqual({
			min: 2,
			max: 5,
		});
	});

	it("requires both bounds", () => {
		expect(
			QuantitySchema.safeParse({
				min: 1,
			}).success,
		).toBe(false);
		expect(
			QuantitySchema.safeParse({
				max: 1,
			}).success,
		).toBe(false);
	});

	it("rejects descending bounds", () => {
		expect(
			QuantitySchema.safeParse({
				min: 2,
				max: 1,
			}).success,
		).toBe(false);
	});
});
