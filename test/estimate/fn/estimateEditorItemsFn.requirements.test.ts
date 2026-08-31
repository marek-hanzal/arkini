import { describe, expect, it } from "vitest";

import type { EditorAcquisitionRequirement } from "~/flow/type/EditorAcquisitionGraph";

import { editorItemEstimateTestFixture } from "~test/estimate/fn/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemsFn", () => {
	it("scales consumed inputs and production duration by deterministic batches", () => {
		const result = estimate(
			graph({
				facts: [
					"ore",
					"ingot",
					"target",
				],
				roots: [
					"ore",
				],
				routes: [
					route({
						allOf: [
							requirement("ore", "consume", 3),
						],
						durationMs: 10,
						id: "smelt",
						output: "ingot",
						outputQuantity: 2,
					}),
					route({
						allOf: [
							requirement("ingot", "consume", 5),
						],
						durationMs: 5,
						id: "assemble",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 35,
			obtainable: true,
		});
	});

	it("charges shared one-time prerequisites once across selected siblings", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"lumberjack",
					"a",
					"b",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						durationMs: 100,
						id: "build-lumberjack",
						output: "lumberjack",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						durationMs: 10,
						id: "make-a",
						output: "a",
						allOf: [
							requirement("lumberjack", "one-time"),
						],
					}),
					route({
						durationMs: 10,
						id: "make-b",
						output: "b",
						allOf: [
							requirement("lumberjack", "one-time"),
						],
					}),
					route({
						allOf: [
							requirement("a"),
							requirement("b"),
						],
						durationMs: 1,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 111,
			obtainable: true,
		});
	});

	it("acquires a deposit once and reuses it across every output run", () => {
		const depositRequirement: EditorAcquisitionRequirement = {
			factId: "deposit",
			quantity: 1,
			source: "deposit-input",
			usage: "one-time",
		};
		const dependencyGraph = graph({
			facts: [
				"deposit",
				"target",
			],
			roots: [],
			routes: [
				route({
					durationMs: 50,
					id: "acquire-deposit",
					output: "deposit",
				}),
				route({
					allOf: [
						depositRequirement,
					],
					durationMs: 2,
					id: "use-deposit",
					output: "target",
				}),
			],
		});

		const result = estimate(dependencyGraph, "target", 10);
		expect(result).toMatchObject({
			durationMs: 70,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected reusable deposit route.");
		expect(result.routeSteps.find(({ factId }) => factId === "deposit")?.quantity).toBe(1);
		expect(
			estimate(
				{
					...dependencyGraph,
					routes: dependencyGraph.routes.filter(
						({ output }) => output.factId !== "deposit",
					),
				},
				"target",
				10,
			),
		).toMatchObject({
			obtainable: false,
			status: "unreachable",
		});
	});

	it("acquires positive enable prerequisites without evaluating rule truth", () => {
		const result = estimate(
			graph({
				facts: [
					"condition",
					"owner",
					"target",
				],
				roots: [
					"owner",
				],
				routes: [
					route({
						allOf: [
							requirement("owner"),
						],
						durationMs: 8,
						id: "make-condition",
						output: "condition",
					}),
					route({
						allOf: [
							{
								factId: "condition",
								quantity: 1,
								source: "line-condition",
								usage: "ongoing",
							},
							{
								factId: "owner",
								quantity: 1,
								source: "owner",
								usage: "one-time",
							},
						],
						durationMs: 10,
						id: "conditioned-route",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 18,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected optimistic conditioned route.");
		expect(result.requirementSummary).toEqual({
			consumed: [
				{
					factId: "owner",
					quantity: 1,
				},
			],
			oneTime: [
				{
					factId: "owner",
					quantity: 1,
				},
			],
			ongoing: [
				{
					factId: "condition",
					quantity: 1,
				},
			],
		});
		expect(result.route.requirements.map(({ factId }) => factId)).toEqual([
			"condition",
			"owner",
		]);
		expect(result.routeSteps.find(({ factId }) => factId === "condition")).toMatchObject({
			durationMs: 8,
			routeId: "make-condition",
		});
	});
});
