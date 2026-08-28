import { describe, expect, it } from "vitest";

import type { EditorAcquisitionGraph } from "~/editor/EditorAcquisitionGraph";

import { editorItemEstimateTestFixture } from "~test/editor/estimator/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemFx", () => {
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

	it("bootstraps a renewable cycle only when its component has an authored seed", () => {
		const dependencyGraph: EditorAcquisitionGraph = {
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
		const dependencyGraph: EditorAcquisitionGraph = {
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
		const dependencyGraph: EditorAcquisitionGraph = {
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
