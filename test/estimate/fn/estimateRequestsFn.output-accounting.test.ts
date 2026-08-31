import { describe, expect, it } from "vitest";

import type { AcquisitionGraph } from "~/flow/type/AcquisitionGraph";

import { itemEstimateTestFixture } from "~test/estimate/fn/itemEstimateTestFixture";

const { estimate, graph, requirement, route } = itemEstimateTestFixture;

describe("estimateRequestsFn", () => {
	it("falls back when the cheapest route overcommits a shared finite root", () => {
		const dependencyGraph = graph({
			facts: [
				"raw",
				"a",
				"b",
				"target",
			],
			roots: [],
			routes: [
				route({
					allOf: [
						requirement("raw"),
					],
					durationMs: 0,
					id: "make-a",
					output: "a",
				}),
				route({
					allOf: [
						requirement("raw"),
					],
					durationMs: 0,
					id: "make-b",
					output: "b",
				}),
				route({
					allOf: [
						requirement("a"),
						requirement("b"),
					],
					durationMs: 0,
					id: "shared-root-route",
					output: "target",
				}),
				route({
					durationMs: 10,
					id: "direct-route",
					output: "target",
				}),
			],
		});
		const result = estimate({
			...dependencyGraph,
			roots: [
				{
					factId: "raw",
					quantity: 1,
				},
			],
		});

		expect(result).toMatchObject({
			durationMs: 10,
			obtainable: true,
			route: {
				routeId: "direct-route",
			},
		});
	});

	it("uses finite starting quantity before producing only the remainder", () => {
		const dependencyGraph = graph({
			facts: [
				"ore",
				"target",
			],
			roots: [
				"ore",
			],
			routes: [
				route({
					allOf: [
						requirement("ore"),
					],
					durationMs: 10,
					id: "make-target",
					output: "target",
				}),
			],
		});
		const result = estimate(
			{
				...dependencyGraph,
				roots: [
					...dependencyGraph.roots,
					{
						factId: "target",
						quantity: 2,
					},
				],
			},
			"target",
			5,
		);

		expect(result).toMatchObject({
			durationMs: 30,
			obtainable: true,
			route: {
				actionRuns: 3,
				rootQuantity: 2,
			},
		});
	});

	it("uses the full output distribution for expected runs and reports zero yield", () => {
		const stochastic = graph({
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
					id: "chance",
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
		});
		const result = estimate(stochastic, "target", 3);
		expect(result).toMatchObject({
			durationMs: 60,
			obtainable: true,
		});

		const impossible: AcquisitionGraph = {
			...stochastic,
			routes: [
				{
					...stochastic.routes[0]!,
					id: "zero-yield",
					output: {
						...stochastic.routes[0]!.output,
						factId: "target",
						quantityDistribution: [
							{
								probability: 1,
								quantity: 0,
							},
						],
					},
				},
			],
		};
		const unreachable = estimate(impossible, "target", 1);
		expect(unreachable).toMatchObject({
			obtainable: false,
		});
		expect(unreachable.diagnostics).toContainEqual(
			expect.objectContaining({
				kind: "zero-yield",
				routeId: "zero-yield",
			}),
		);
	});

	it("uses expected hitting time when positive output ranges can overshoot the target", () => {
		const result = estimate(
			graph({
				facts: [
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 10,
						id: "positive-range",
						output: "target",
						quantityDistribution: [
							{
								probability: 0.5,
								quantity: 1,
							},
							{
								probability: 0.5,
								quantity: 2,
							},
						],
					}),
				],
			}),
			"target",
			2,
		);

		expect(result).toMatchObject({
			durationMs: 15,
			obtainable: true,
			route: {
				actionRuns: 1.5,
				outputRuns: 1.5,
			},
		});
	});
});
