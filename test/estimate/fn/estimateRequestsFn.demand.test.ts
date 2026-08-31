import { describe, expect, it } from "vitest";

import { itemEstimateTestFixture } from "~test/estimate/fn/itemEstimateTestFixture";

const { estimate, graph, requirement, route } = itemEstimateTestFixture;

describe("estimateRequestsFn", () => {
	it("compares complete route cost at the requested batch quantity", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 10,
						id: "small-batch",
						output: "target",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 21,
						id: "large-batch",
						output: "target",
						outputQuantity: 3,
					}),
				],
			}),
			"target",
			5,
		);

		expect(result).toMatchObject({
			durationMs: 42,
			obtainable: true,
			route: {
				routeId: "large-batch",
			},
		});
	});

	it("compares nested acquisition routes at their demanded batch quantity", () => {
		const result = estimate(
			graph({
				facts: [
					"x",
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 10,
						id: "x-small",
						output: "x",
					}),
					route({
						durationMs: 21,
						id: "x-batch",
						output: "x",
						outputQuantity: 3,
					}),
					route({
						allOf: [
							requirement("x", "consume", 5),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 42,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected nested route.");
		if (result.obtainable)
			expect(result.routeSteps.find(({ factId }) => factId === "x")?.routeId).toBe("x-batch");
	});

	it("compares any-of requirements by complete demanded batch cost", () => {
		const result = estimate(
			graph({
				facts: [
					"x",
					"y",
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 10,
						id: "x-small",
						output: "x",
					}),
					route({
						durationMs: 21,
						id: "x-batch",
						output: "x",
						outputQuantity: 3,
					}),
					route({
						durationMs: 45,
						id: "make-y",
						output: "y",
						outputQuantity: 5,
					}),
					route({
						anyOf: [
							[
								requirement("x", "consume", 5),
								requirement("y", "consume", 5),
							],
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 42,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected any-of route.");
		expect(result.route.requirements[0]?.factId).toBe("x");
	});

	it("propagates batch costs through a multi-level dependency chain", () => {
		const result = estimate(
			graph({
				facts: [
					"z",
					"y",
					"x",
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 21,
						id: "z-batch",
						output: "z",
						outputQuantity: 3,
					}),
					route({
						allOf: [
							requirement("z", "consume", 5),
						],
						durationMs: 0,
						id: "y-via-z",
						output: "y",
					}),
					route({
						durationMs: 50,
						id: "y-direct",
						output: "y",
					}),
					route({
						allOf: [
							requirement("y"),
						],
						durationMs: 0,
						id: "x-via-y",
						output: "x",
					}),
					route({
						durationMs: 45,
						id: "x-direct",
						output: "x",
					}),
					route({
						allOf: [
							requirement("x"),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 42,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected deep route.");
		if (result.obtainable) {
			expect(result.routeSteps.find(({ factId }) => factId === "x")?.routeId).toBe("x-via-y");
			expect(result.routeSteps.find(({ factId }) => factId === "y")?.routeId).toBe("y-via-z");
		}
	});
});
