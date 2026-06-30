import { describe, expect, it } from "vitest";
import { ProducerProductLineViewSchema } from "~/v0/board/view/ProducerProductLineViewSchema";

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
	productId: "product:log",
	queueFull: false,
	queuedJobs: 0,
	queueSize: 1,
};

describe("ProducerProductLineViewSchema", () => {
	it("requires runtime product-line views to expose their line kind", () => {
		expect(ProducerProductLineViewSchema.safeParse(baseLine).success).toBe(false);
	});

	it("requires effect lines to expose the effect polarity used by UI grouping", () => {
		expect(
			ProducerProductLineViewSchema.safeParse({
				...baseLine,
				lineKind: "effect",
			}).success,
		).toBe(false);
	});

	it("rejects polarity on plain product lines", () => {
		expect(
			ProducerProductLineViewSchema.safeParse({
				...baseLine,
				effectPolarity: "buff",
				lineKind: "product",
			}).success,
		).toBe(false);
	});

	it("accepts explicit product and effect line views", () => {
		expect(
			ProducerProductLineViewSchema.safeParse({
				...baseLine,
				lineKind: "product",
			}).success,
		).toBe(true);
		expect(
			ProducerProductLineViewSchema.safeParse({
				...baseLine,
				effectPolarity: "buff",
				lineKind: "effect",
			}).success,
		).toBe(true);
	});
});
