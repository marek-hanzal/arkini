import { describe, expect, it } from "vitest";
import { ProducerLineViewSchema } from "~/v0/board/view/ProducerLineViewSchema";

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
	producerQueuedJobs: 0,
	lineId: "line:log",
	queueFull: false,
	queuedJobs: 0,
	queueSize: 1,
};

describe("ProducerLineViewSchema", () => {
	it("requires runtime product-line views to expose their line kind", () => {
		expect(ProducerLineViewSchema.safeParse(baseLine).success).toBe(false);
	});

	it("requires effect lines to expose the effect polarity used by UI grouping", () => {
		expect(
			ProducerLineViewSchema.safeParse({
				...baseLine,
				lineKind: "effect",
			}).success,
		).toBe(false);
	});

	it("rejects polarity on plain producer lines", () => {
		expect(
			ProducerLineViewSchema.safeParse({
				...baseLine,
				effectPolarity: "buff",
				lineKind: "product",
			}).success,
		).toBe(false);
	});

	it("accepts explicit product and effect line views", () => {
		expect(
			ProducerLineViewSchema.safeParse({
				...baseLine,
				lineKind: "product",
			}).success,
		).toBe(true);
		expect(
			ProducerLineViewSchema.safeParse({
				...baseLine,
				effectPolarity: "buff",
				lineKind: "effect",
			}).success,
		).toBe(true);
	});
});
