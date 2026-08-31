import { describe, expect, it } from "vitest";

import type { AcquisitionGraph } from "~/flow/type/AcquisitionGraph";

import { itemEstimateTestFixture } from "~test/estimate/fn/itemEstimateTestFixture";

const { estimate, graph, requirement, route } = itemEstimateTestFixture;

describe("estimateRequestsFn", () => {
	it("bootstraps a renewable cycle only when its component has an authored seed", () => {
		const dependencyGraph: AcquisitionGraph = {
			...graph({
				facts: [
					"a",
					"b",
				],
				roots: [],
				routes: [
					route({
						allOf: [
							requirement("b", "one-time"),
						],
						durationMs: 10,
						id: "make-a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("a", "one-time"),
						],
						durationMs: 5,
						id: "make-b",
						output: "b",
					}),
				],
			}),
			roots: [
				{
					factId: "a",
					quantity: 1,
				},
			],
		};

		expect(estimate(dependencyGraph, "a", 2)).toMatchObject({
			durationMs: 15,
			obtainable: true,
		});
		expect(
			estimate(
				{
					...dependencyGraph,
					roots: [],
				},
				"a",
				1,
			),
		).toMatchObject({
			obtainable: false,
		});
	});

	it("ignores charged renewal cycles when choosing a route", () => {
		const deadRoutes = Array.from(
			{
				length: 9,
			},
			(_, index) =>
				route({
					allOf: [
						requirement(`missing-${index}`),
					],
					durationMs: 0,
					id: `a-dead-${index}`,
					output: "target",
				}),
		);
		const result = estimate(
			{
				factIds: [
					"payer",
					"target",
					...deadRoutes.map((_, index) => `missing-${index}`),
				],
				limitations: [],
				roots: [
					{
						factId: "payer",
						quantity: 1,
					},
				],
				routes: [
					...deadRoutes,
					route({
						chargeUses: [
							{
								payerFactId: "payer",
								usableActionRuns: 1,
							},
						],
						durationMs: 1,
						id: "z-charged-target",
						output: "target",
					}),
					route({
						allOf: [
							requirement("target", "one-time"),
						],
						durationMs: 1,
						id: "make-payer",
						output: "payer",
					}),
				],
			},
			"target",
			2,
		);

		expect(result).toMatchObject({
			durationMs: 2,
			status: "complete",
		});
	});

	it("does not fabricate supply from a seeded consumptive zero-net cycle", () => {
		const dependencyGraph: AcquisitionGraph = {
			...graph({
				facts: [
					"a",
					"b",
				],
				roots: [],
				routes: [
					route({
						allOf: [
							requirement("b"),
						],
						durationMs: 1,
						id: "make-a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("a"),
						],
						durationMs: 1,
						id: "make-b",
						output: "b",
					}),
				],
			}),
			roots: [
				{
					factId: "a",
					quantity: 1,
				},
			],
		};

		expect(estimate(dependencyGraph, "a", 2)).toMatchObject({
			obtainable: false,
		});
	});

	it("requires a seed to cover the retained quantity that bootstraps a cycle", () => {
		const dependencyGraph: AcquisitionGraph = {
			...graph({
				facts: [
					"a",
					"b",
				],
				roots: [],
				routes: [
					route({
						allOf: [
							requirement("b", "one-time", 2),
						],
						durationMs: 10,
						id: "make-a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("a", "one-time", 2),
						],
						durationMs: 5,
						id: "make-b",
						output: "b",
					}),
				],
			}),
			roots: [
				{
					factId: "a",
					quantity: 1,
				},
			],
		};

		expect(estimate(dependencyGraph, "a", 2)).toMatchObject({
			obtainable: false,
		});
	});
});
