import { describe, expect, it } from "vitest";
import { LineViewSchema } from "~/board/view/LineViewSchema";

const baseLine = {
	blocked: false,
	durationMs: 1000,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: true,
	name: "Log",
	queueUsed: 0,
	lineId: "line:log",
	queueFull: false,
	jobs: 0,
	queueMax: 1,
};

describe("LineViewSchema", () => {
	it("requires runtime line views to expose their line kind", () => {
		expect(LineViewSchema.safeParse(baseLine).success).toBe(false);
	});

	it("requires effect lines to expose the effect polarity used by UI grouping", () => {
		expect(
			LineViewSchema.safeParse({
				...baseLine,
				kind: "effect",
			}).success,
		).toBe(false);
	});

	it("rejects polarity on plain lines", () => {
		expect(
			LineViewSchema.safeParse({
				...baseLine,
				effectPolarity: "buff",
				kind: "product",
			}).success,
		).toBe(false);
	});

	it("accepts explicit product and effect line views", () => {
		expect(
			LineViewSchema.safeParse({
				...baseLine,
				kind: "product",
			}).success,
		).toBe(true);
		expect(
			LineViewSchema.safeParse({
				...baseLine,
				effectPolarity: "buff",
				kind: "effect",
			}).success,
		).toBe(true);
	});
});
