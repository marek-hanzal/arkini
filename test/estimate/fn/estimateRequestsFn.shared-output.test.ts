import { describe, expect, it } from "vitest";

import { itemEstimateTestFixture } from "~test/estimate/fn/itemEstimateTestFixture";

const { estimate, graph, requirement, route } = itemEstimateTestFixture;

describe("estimateRequestsFn", () => {
	it("pays one atomic operation once when its co-products satisfy sibling demands", () => {
		const operation = {
			id: "make-a-and-b",
			inputs: [],
			outputDistribution: [
				{
					probability: 1,
					quantities: [
						{
							outputGroupId: "a",
							quantity: 1,
						},
						{
							outputGroupId: "b",
							quantity: 1,
						},
					],
				},
			],
		} as const;
		const result = estimate(
			graph({
				facts: [
					"fuel",
					"a",
					"b",
					"target",
				],
				roots: [
					"fuel",
				],
				routes: [
					route({
						allOf: [
							requirement("fuel"),
						],
						durationMs: 10,
						id: "make-a",
						operation,
						operationOutputGroupId: "a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("fuel"),
						],
						durationMs: 10,
						id: "make-b",
						operation,
						operationOutputGroupId: "b",
						output: "b",
					}),
					route({
						allOf: [
							requirement("a"),
							requirement("b"),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
					route({
						durationMs: 15,
						id: "direct-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 10,
			obtainable: true,
			route: {
				routeId: "make-target",
			},
		});
		if (!result.obtainable) throw new Error("Expected shared co-product route.");
		expect(
			result.requirementSummary.consumed.filter(({ factId }) => factId === "fuel"),
		).toEqual([
			{
				factId: "fuel",
				quantity: 1,
			},
		]);
	});

	it("compares locally cheap co-product routes by their joint critical path", () => {
		const independentFactIds = Array.from(
			{
				length: 9,
			},
			(_, index) => `independent-${index}`,
		);
		const operation = {
			id: "alternating-a-or-b",
			inputs: [],
			outputDistribution: [
				{
					probability: 0.5,
					quantities: [
						{
							outputGroupId: "a",
							quantity: 1,
						},
						{
							outputGroupId: "b",
							quantity: 0,
						},
					],
				},
				{
					probability: 0.5,
					quantities: [
						{
							outputGroupId: "a",
							quantity: 0,
						},
						{
							outputGroupId: "b",
							quantity: 1,
						},
					],
				},
			],
		} as const;
		const makeSharedOutput = (factId: "a" | "b") =>
			route({
				durationMs: 1,
				id: `z-shared-${factId}`,
				operation,
				operationOutputGroupId: factId,
				output: factId,
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
			});
		const result = estimate(
			graph({
				facts: [
					"a",
					"b",
					...independentFactIds,
					"target",
				],
				roots: [],
				routes: [
					makeSharedOutput("a"),
					makeSharedOutput("b"),
					...independentFactIds.flatMap((factId) => [
						route({
							durationMs: 1,
							id: `a-${factId}`,
							output: factId,
						}),
						route({
							durationMs: 1,
							id: `b-${factId}`,
							output: factId,
						}),
					]),
					route({
						durationMs: 2.5,
						id: "standalone-a",
						output: "a",
					}),
					route({
						durationMs: 2.5,
						id: "standalone-b",
						output: "b",
					}),
					route({
						allOf: [
							requirement("a"),
							requirement("b"),
							...independentFactIds.map((factId) => requirement(factId)),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 2.5,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected standalone sibling routes.");
		expect(result.routeSteps.find(({ factId }) => factId === "a")?.routeId).toBe(
			"standalone-a",
		);
		expect(result.routeSteps.find(({ factId }) => factId === "b")?.routeId).toBe(
			"standalone-b",
		);
	});

	it("ignores charge capacity while sharing co-product work", () => {
		const operation = {
			id: "charged-a-and-b",
			inputs: [],
			outputDistribution: [
				{
					probability: 0.5,
					quantities: [
						{
							outputGroupId: "a",
							quantity: 1,
						},
						{
							outputGroupId: "b",
							quantity: 1,
						},
					],
				},
				{
					probability: 0.5,
					quantities: [
						{
							outputGroupId: "a",
							quantity: 3,
						},
						{
							outputGroupId: "b",
							quantity: 3,
						},
					],
				},
			],
		} as const;
		const makeSharedOutput = (factId: "a" | "b") =>
			route({
				allOf: [
					requirement("fuel"),
				],
				chargeUses: [
					{
						accounting: "single-payer-exact",
						payerFactId: "payer",
						usableActionRuns: 2,
					},
				],
				durationMs: 10,
				id: `make-${factId}`,
				operation,
				operationOutputGroupId: factId,
				output: factId,
				outputQuantity: 3,
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
			});
		const result = estimate(
			graph({
				facts: [
					"fuel",
					"payer",
					"a",
					"b",
					"target",
				],
				roots: [
					"fuel",
					"payer",
				],
				routes: [
					makeSharedOutput("a"),
					makeSharedOutput("b"),
					route({
						allOf: [
							requirement("a", "consume", 5),
							requirement("b", "consume", 5),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 29.375,
			obtainable: true,
		});
	});
});
