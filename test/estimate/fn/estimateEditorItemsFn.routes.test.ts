import { describe, expect, it } from "vitest";

import { editorItemEstimateTestFixture } from "~test/estimate/fn/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemsFn route selection", () => {
	it("breaks equal-cost non-ASCII route IDs by stable code units", () => {
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
						id: "ä-route",
						output: "target",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 10,
						id: "z-route",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			obtainable: true,
			route: {
				routeId: "z-route",
			},
		});
	});

	it("scales demand by scalar expected yield", () => {
		const result = estimate(
			graph({
				facts: [
					"ore",
					"ingot",
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
						expectedYield: 2,
						id: "smelt",
						output: "ingot",
					}),
				],
			}),
			"ingot",
			5,
		);

		expect(result).toMatchObject({
			durationMs: 25,
			obtainable: true,
			requirementSummary: {
				consumed: [
					{
						factId: "ore",
						quantity: 7.5,
					},
				],
			},
			route: {
				actionRuns: 2.5,
				outputRuns: 2.5,
				routeId: "smelt",
			},
		});
	});

	it("uses scalar unit action runs when admitting a finite-root route", () => {
		const result = estimate(
			graph({
				facts: [
					"b",
					"root",
					"target",
				],
				roots: [
					{
						factId: "b",
						quantity: 1,
					},
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("b", "consume"),
						],
						durationMs: 1,
						expectedYield: 0.5,
						id: "fast-underseeded",
						output: "target",
					}),
					route({
						allOf: [
							requirement("root", "consume"),
						],
						durationMs: 10,
						id: "slow-complete",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 10,
			obtainable: true,
			route: {
				routeId: "slow-complete",
			},
		});
	});

	it("records the first locally ranked route once the fact becomes reachable", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"slow-tool",
					"fast-tool",
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
						id: "build-slow-tool",
						output: "slow-tool",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 100,
						id: "build-fast-tool",
						output: "fast-tool",
					}),
					route({
						allOf: [
							requirement("slow-tool", "one-time"),
						],
						durationMs: 5,
						id: "locally-fast",
						output: "target",
					}),
					route({
						allOf: [
							requirement("fast-tool", "one-time"),
						],
						durationMs: 30,
						id: "complete-route-fast",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 1_205,
			obtainable: true,
			route: {
				routeId: "locally-fast",
			},
		});
	});

	it("overlaps independent dependency branches on the optimistic critical path", () => {
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
						allOf: [
							requirement("root"),
						],
						durationMs: 120,
						id: "make-a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 80,
						id: "make-b",
						output: "b",
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
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.routeSteps.map(({ factId }) => factId)).toEqual([
			"target",
			"a",
			"b",
			"root",
		]);
		expect(result.routeSteps.find(({ factId }) => factId === "root")?.occurrenceCount).toBe(2);
	});

	it("chooses one reachable any-of alternative", () => {
		const result = estimate(
			graph({
				facts: [
					"dead",
					"root",
					"tool",
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
						durationMs: 20,
						id: "make-tool",
						output: "tool",
					}),
					route({
						anyOf: [
							[
								requirement("dead"),
								requirement("tool", "one-time"),
							],
						],
						durationMs: 5,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 25,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.route.requirements).toContainEqual(
			expect.objectContaining({
				factId: "tool",
				usage: "one-time",
			}),
		);
	});

	it("uses stable route identity to break equal-duration ties", () => {
		const result = estimate(
			graph({
				facts: [
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 10,
						id: "z-route",
						output: "target",
					}),
					route({
						durationMs: 10,
						id: "a-route",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			obtainable: true,
			route: {
				routeId: "a-route",
			},
		});
	});
});
