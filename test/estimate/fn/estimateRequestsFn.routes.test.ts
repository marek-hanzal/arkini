import { describe, expect, it } from "vitest";

import { itemEstimateMaximumQuantity } from "~/estimate/schema/ItemEstimateQuantitySchema";

import { itemEstimateTestFixture } from "~test/estimate/fn/itemEstimateTestFixture";

const { estimate, graph, requirement, route } = itemEstimateTestFixture;

describe("estimateRequestsFn", () => {
	it("bounds public requests before building an estimate policy", () => {
		const quantity = itemEstimateMaximumQuantity + 1;
		const result = estimate(
			graph({
				facts: [
					"target",
				],
				roots: [],
				routes: [],
			}),
			"target",
			quantity,
		);

		expect(result).toMatchObject({
			diagnostics: [
				{
					factId: "target",
					kind: "quantity-limit-exceeded",
					maximumQuantity: itemEstimateMaximumQuantity,
					quantity,
					source: "request",
				},
			],
			status: "partial",
		});
	});

	it("reports oversized authored dependency demand as partial", () => {
		const quantity = itemEstimateMaximumQuantity + 1;
		const result = estimate(
			graph({
				facts: [
					"root",
					"material",
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
						durationMs: 1,
						id: "make-material",
						output: "material",
						quantityDistribution: [
							{
								probability: 0.5,
								quantity: 0,
							},
							{
								probability: 0.5,
								quantity: 1,
							},
						],
					}),
					route({
						allOf: [
							requirement("material", "consume", quantity),
						],
						durationMs: 1,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			diagnostics: [
				{
					factId: "material",
					kind: "quantity-limit-exceeded",
					maximumQuantity: itemEstimateMaximumQuantity,
					quantity,
					source: "authored-demand",
				},
			],
			status: "partial",
		});
	});

	it("selects an acquisition route by its complete upstream duration", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"expensive-infrastructure",
					"cheap-infrastructure",
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
						durationMs: 1_200,
						id: "build-expensive",
						output: "expensive-infrastructure",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 100,
						id: "build-cheap",
						output: "cheap-infrastructure",
					}),
					route({
						allOf: [
							requirement("expensive-infrastructure", "one-time"),
						],
						durationMs: 5,
						id: "locally-fast",
						output: "target",
					}),
					route({
						allOf: [
							requirement("cheap-infrastructure", "one-time"),
						],
						durationMs: 30,
						id: "complete-route-fast",
						output: "target",
					}),
				],
			}),
		);
		expect(result).toMatchObject({
			durationMs: 130,
			obtainable: true,
			route: {
				routeId: "complete-route-fast",
			},
		});
	});

	it("requires every AND sibling and runs independent branches in parallel", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"a",
					"b",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						durationMs: 120,
						id: "make-a",
						output: "a",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						durationMs: 120,
						id: "make-b",
						output: "b",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						allOf: [
							requirement("a"),
							requirement("b"),
						],
						durationMs: 10,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 130,
			obtainable: true,
		});
	});
});
