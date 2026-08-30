import { describe, expect, it } from "vitest";

import { createEditorItemEstimateIndexFn } from "~/estimate/fn/createEditorItemEstimateIndexFn";

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

	it("selects the route with the shortest complete scalar critical path", () => {
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
			durationMs: 130,
			obtainable: true,
			route: {
				routeId: "complete-route-fast",
			},
		});
	});

	it("breaks equal materialized route times by stable route identity", () => {
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
						id: "make-x",
						output: "x",
					}),
					route({
						durationMs: 10,
						id: "make-y",
						output: "y",
					}),
					route({
						allOf: [
							requirement("x"),
							requirement("x", "one-time"),
						],
						durationMs: 0,
						id: "a-split",
						output: "target",
					}),
					route({
						allOf: [
							requirement("y"),
						],
						durationMs: 0,
						id: "z-simple",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 10,
			obtainable: true,
			route: {
				routeId: "a-split",
			},
		});
	});

	it("scales consumed work without reacquiring a reusable upstream prerequisite", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"tool",
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
						durationMs: 1_000,
						id: "make-tool",
						output: "tool",
					}),
					route({
						allOf: [
							requirement("tool", "one-time"),
						],
						durationMs: 1,
						id: "material-with-tool",
						output: "material",
					}),
					route({
						durationMs: 600,
						id: "material-direct",
						output: "material",
					}),
					route({
						allOf: [
							requirement("material", "consume", 2),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 1_002,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.routeSteps.find(({ factId }) => factId === "material")?.routeId).toBe(
			"material-with-tool",
		);
	});

	it("compares materialized SCC fallback cost against a direct route", () => {
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
							requirement("b", "one-time", 2),
						],
						durationMs: 0,
						id: "b-cheap-underseeded",
						output: "b",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 100,
						id: "b-complete",
						output: "b",
					}),
					route({
						allOf: [
							requirement("b", "one-time", 2),
						],
						durationMs: 1,
						id: "target-via-b",
						output: "target",
					}),
					route({
						durationMs: 10,
						id: "target-direct",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 10,
			obtainable: true,
			route: {
				routeId: "target-direct",
			},
		});
	});

	it("retries a failing any-of clause after grouped demand outgrows its finite seed", () => {
		const result = estimate(
			graph({
				facts: [
					"a",
					"root",
					"target",
					"z",
				],
				roots: [
					{
						factId: "a",
						quantity: 1,
					},
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("a", "one-time", 2),
						],
						durationMs: 0,
						id: "a-underseeded",
						output: "a",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 100,
						id: "a-complete",
						output: "a",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 10,
						id: "z-complete",
						output: "z",
					}),
					route({
						allOf: [
							requirement("a"),
						],
						anyOf: [
							[
								requirement("a"),
								requirement("z"),
							],
						],
						durationMs: 1,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 11,
			obtainable: true,
			route: {
				routeId: "make-target",
			},
		});
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.route.requirements).toContainEqual(
			expect.objectContaining({
				factId: "z",
			}),
		);
	});

	it("chooses any-of alternatives from the final grouped demand state", () => {
		const result = estimate(
			graph({
				facts: [
					"a",
					"b",
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 50,
						id: "make-a",
						output: "a",
					}),
					route({
						durationMs: 60,
						id: "make-b",
						output: "b",
					}),
					route({
						anyOf: [
							[
								requirement("a"),
								requirement("b"),
							],
							[
								requirement("a"),
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
			durationMs: 60,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.route.requirements).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					factId: "a",
					quantity: 1,
				}),
				expect.objectContaining({
					factId: "b",
					quantity: 1,
				}),
			]),
		);
	});

	it("breaks equal any-of alternatives by stable fact identity", () => {
		const result = estimate(
			graph({
				facts: [
					"a",
					"b",
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 10,
						id: "make-a",
						output: "a",
					}),
					route({
						durationMs: 10,
						id: "make-b",
						output: "b",
					}),
					route({
						anyOf: [
							[
								requirement("b"),
								requirement("a"),
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
			durationMs: 10,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.route.requirements).toEqual([
			expect.objectContaining({
				factId: "a",
			}),
		]);
	});

	it("keeps distinct one-time subtotal when normalizing any-of demand states", () => {
		const result = estimate(
			graph({
				facts: [
					"x",
					"target",
				],
				roots: [
					{
						factId: "x",
						quantity: 2,
					},
				],
				routes: [
					route({
						anyOf: [
							[
								requirement("x", "one-time", 2),
								requirement("x", "one-time", 2, "distinct"),
							],
							[
								requirement("x", "one-time", 1, "distinct"),
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
			obtainable: true,
			route: {
				requirements: [
					expect.objectContaining({
						factId: "x",
						quantity: 2,
						usage: "one-time",
					}),
				],
			},
		});
	});

	it("returns partial instead of truncating incomparable any-of demand states", () => {
		const alternatives = Array.from(
			{
				length: 65,
			},
			(_, index) => `seed-${index}`,
		);
		const result = estimate(
			graph({
				facts: [
					...alternatives,
					"target",
				],
				roots: alternatives,
				routes: [
					route({
						anyOf: [
							alternatives.map((factId) => requirement(factId)),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			obtainable: false,
			status: "partial",
		});
		expect(result.diagnostics).toContainEqual({
			factId: "target",
			kind: "any-of-selection-limit-exceeded",
			maximumSelections: 64,
			routeId: "make-target",
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

	it("shares a reusable prerequisite across compressed dependency paths", () => {
		const dependencyGraph = graph({
			facts: [
				"root",
				"tool",
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
					durationMs: 10,
					id: "make-tool",
					output: "tool",
				}),
				route({
					allOf: [
						requirement("tool", "ongoing"),
					],
					durationMs: 1,
					id: "make-a",
					output: "a",
				}),
				route({
					allOf: [
						requirement("tool", "one-time"),
					],
					durationMs: 1,
					id: "make-b",
					output: "b",
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
		});
		const result = estimate(dependencyGraph);

		expect(result).toMatchObject({
			durationMs: 12,
			obtainable: true,
			requirementSummary: {
				oneTime: [
					{
						factId: "tool",
						quantity: 1,
					},
				],
				ongoing: [
					{
						factId: "tool",
						quantity: 1,
					},
				],
			},
		});
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.routeSteps.find(({ factId }) => factId === "tool")?.occurrenceCount).toBe(1);
		expect(
			createEditorItemEstimateIndexFn({
				estimates: new Map([
					[
						"target",
						result,
					],
					[
						"tool",
						estimate(dependencyGraph, "tool"),
					],
				]),
				itemIds: [
					"tool",
				],
			})[0]?.demand,
		).toBe(2);
	});

	it("adds a consumed occurrence beside one shared retained occurrence", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"tool",
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
						durationMs: 0,
						id: "make-tool",
						output: "tool",
					}),
					route({
						allOf: [
							requirement("tool"),
						],
						durationMs: 0,
						id: "make-a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("tool", "one-time"),
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
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result.obtainable).toBe(true);
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.routeSteps.find(({ factId }) => factId === "tool")?.occurrenceCount).toBe(2);
	});

	it("canonicalizes different retained quantities to one maximum acquisition", () => {
		const dependencyGraph = graph({
			facts: [
				"root",
				"tool",
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
					durationMs: 1,
					id: "make-tool",
					output: "tool",
				}),
				route({
					allOf: [
						requirement("tool", "one-time"),
					],
					durationMs: 0,
					id: "make-a",
					output: "a",
				}),
				route({
					allOf: [
						requirement("tool", "ongoing", 2),
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
					id: "make-target",
					output: "target",
				}),
			],
		});
		const result = estimate(dependencyGraph);

		expect(result.obtainable).toBe(true);
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(result.routeSteps.filter(({ factId }) => factId === "tool")).toEqual([
			expect.objectContaining({
				occurrenceCount: 1,
				quantity: 2,
			}),
		]);
		expect(
			createEditorItemEstimateIndexFn({
				estimates: new Map([
					[
						"target",
						result,
					],
					[
						"tool",
						estimate(dependencyGraph, "tool"),
					],
				]),
				itemIds: [
					"tool",
				],
			})[0]?.demand,
		).toBe(3);
	});

	it("rematerializes every retained branch at the stable maximum quantity", () => {
		const result = estimate(
			graph({
				facts: [
					"seed",
					"tool",
					"a",
					"b",
					"target",
				],
				roots: [
					{
						factId: "seed",
						quantity: 1,
					},
				],
				routes: [
					route({
						allOf: [
							requirement("seed"),
						],
						durationMs: 1,
						id: "tool-fast-once",
						output: "tool",
					}),
					route({
						durationMs: 25,
						id: "tool-slow-repeatable",
						output: "tool",
					}),
					route({
						allOf: [
							requirement("tool", "one-time"),
						],
						durationMs: 100,
						id: "make-a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("tool", "ongoing", 2),
						],
						durationMs: 1,
						id: "make-b",
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
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 150,
			obtainable: true,
		});
	});

	it("keeps consumed demand additive beside a stable retained maximum", () => {
		const dependencyGraph = graph({
			facts: [
				"root",
				"tool",
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
					durationMs: 0,
					id: "make-tool",
					output: "tool",
				}),
				route({
					allOf: [
						requirement("tool"),
						requirement("tool", "one-time"),
					],
					durationMs: 0,
					id: "make-a",
					output: "a",
				}),
				route({
					allOf: [
						requirement("tool", "ongoing", 2),
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
					id: "make-target",
					output: "target",
				}),
			],
		});
		const result = estimate(dependencyGraph);

		expect(result.obtainable).toBe(true);
		if (!result.obtainable) throw new Error("Expected complete route.");
		expect(
			result.routeSteps
				.filter(({ factId }) => factId === "tool")
				.reduce((demand, step) => demand + step.quantity * step.occurrenceCount, 0),
		).toBe(3);
		expect(
			createEditorItemEstimateIndexFn({
				estimates: new Map([
					[
						"target",
						result,
					],
					[
						"tool",
						estimate(dependencyGraph, "tool"),
					],
				]),
				itemIds: [
					"tool",
				],
			})[0]?.demand,
		).toBe(4);
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
