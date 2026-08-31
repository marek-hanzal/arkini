import { describe, expect, it } from "vitest";

import { itemEstimateTestFixture } from "~test/estimate/fn/itemEstimateTestFixture";

const { estimate, graph, requirement, route } = itemEstimateTestFixture;

describe("estimateRequestsFn", () => {
	it("ignores unsupported multi-payer charge accounting", () => {
		const result = estimate(
			graph({
				facts: [
					"payer",
					"target",
				],
				roots: [
					"payer",
				],
				routes: [
					route({
						chargeUses: [
							{
								accounting: "multi-payer-unsupported",
								payerFactId: "payer",
								usableActionRuns: 0,
							},
						],
						durationMs: 1,
						id: "unsupported",
						output: "target",
					}),
					route({
						durationMs: 10,
						id: "complete",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			obtainable: true,
			route: {
				routeId: "unsupported",
			},
		});
	});

	it("uses expected stochastic output runs without charge capacity", () => {
		const result = estimate(
			graph({
				facts: [
					"payer",
					"target",
				],
				roots: [
					"payer",
				],
				routes: [
					route({
						chargeUses: [
							{
								accounting: "single-payer-exact",
								payerFactId: "payer",
								usableActionRuns: 2,
							},
						],
						durationMs: 1,
						id: "stochastic-charged",
						output: "target",
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
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 2,
			status: "complete",
		});
	});

	it("does not add charged payer instances to stochastic output timing", () => {
		const result = estimate(
			graph({
				facts: [
					"payer",
					"target",
				],
				roots: [
					"payer",
				],
				routes: [
					route({
						chargeUses: [
							{
								accounting: "single-payer-exact",
								payerFactId: "payer",
								usableActionRuns: 2,
							},
						],
						durationMs: 10,
						id: "positive-stochastic-charged",
						output: "target",
						quantityDistribution: [
							{
								probability: 0.5,
								quantity: 1,
							},
							{
								probability: 0.5,
								quantity: 3,
							},
						],
					}),
				],
			}),
			"target",
			3,
		);

		expect(result).toMatchObject({
			durationMs: 17.5,
			obtainable: true,
			status: "complete",
		});
	});

	it("uses a faster nested stochastic route regardless of charge lifetime", () => {
		const result = estimate(
			graph({
				facts: [
					"payer",
					"x",
					"target",
				],
				roots: [
					"payer",
				],
				routes: [
					route({
						allOf: [
							requirement("x"),
						],
						durationMs: 1,
						id: "make-target",
						output: "target",
					}),
					route({
						chargeUses: [
							{
								accounting: "single-payer-exact",
								payerFactId: "payer",
								usableActionRuns: 2,
							},
						],
						durationMs: 1,
						id: "a-stochastic-x",
						output: "x",
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
						durationMs: 20,
						id: "z-complete-x",
						output: "x",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 3,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected nested complete route.");
		expect(result.routeSteps.find(({ factId }) => factId === "x")?.routeId).toBe(
			"a-stochastic-x",
		);
	});
});
