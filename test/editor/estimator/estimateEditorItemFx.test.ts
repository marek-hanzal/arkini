import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type {
	EditorEstimateDependencyGraph,
	EditorEstimateRequirement,
	EditorEstimateRoute,
} from "~/editor/estimator/EditorEstimateDependencyGraph";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";

const requirement = (
	factId: string,
	usage: EditorEstimateRequirement["usage"] = "consume",
	quantity = 1,
): EditorEstimateRequirement => ({
	factId,
	quantity,
	source: "material-input",
	usage,
});

const route = ({
	allOf = [],
	anyOf = [],
	durationMs,
	id,
	output,
	outputQuantity = 1,
	quantityDistribution,
}: {
	readonly allOf?: ReadonlyArray<EditorEstimateRequirement>;
	readonly anyOf?: ReadonlyArray<ReadonlyArray<EditorEstimateRequirement>>;
	readonly durationMs: number;
	readonly id: string;
	readonly output: string;
	readonly outputQuantity?: number;
	readonly quantityDistribution?: EditorEstimateRoute["output"]["quantityDistribution"];
}): EditorEstimateRoute => ({
	durationMs,
	id,
	metadata: {
		kind: "line-output",
		lineId: id,
		ownerItemId: "owner",
	},
	output: {
		factId: output,
		quantityDistribution: quantityDistribution ?? [
			{
				probability: 1,
				quantity: outputQuantity,
			},
		],
	},
	runMultiplier: 1,
	requirements: {
		allOf,
		anyOf,
	},
});

const graph = ({
	facts,
	roots,
	routes,
}: {
	readonly facts: ReadonlyArray<string>;
	readonly roots: ReadonlyArray<string>;
	readonly routes: ReadonlyArray<EditorEstimateRoute>;
}): EditorEstimateDependencyGraph => ({
	factIds: facts,
	limitations: [],
	roots: roots.map((factId) => ({
		factId,
		quantity: "unbounded",
	})),
	routes,
});

const estimate = (
	dependencyGraph: EditorEstimateDependencyGraph,
	factId = "target",
	quantity = 1,
) =>
	Effect.runSync(
		estimateEditorItemFx({
			factId,
			graph: dependencyGraph,
			quantity,
		}),
	);

describe("estimateEditorItemFx", () => {
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

	it("requires every AND sibling and serializes their durations", () => {
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
			durationMs: 250,
			obtainable: true,
		});
	});

	it("selects one complete alternative in an any-of requirement", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"slow",
					"fast",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						durationMs: 300,
						id: "make-slow",
						output: "slow",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						durationMs: 20,
						id: "make-fast",
						output: "fast",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						anyOf: [
							[
								requirement("slow"),
								requirement("fast"),
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
		if (result.obtainable)
			expect(result.route.requirements[0]?.acquisition?.factId).toBe("fast");
	});

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
			consumables: [
				{
					factId: "ingot",
					quantity: 5,
				},
				{
					factId: "ore",
					quantity: 9,
				},
			],
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
			durationMs: 121,
			obtainable: true,
			oneTimeRequirements: [
				{
					factId: "lumberjack",
					quantity: 1,
				},
			],
		});
	});

	it("rejects a cyclic candidate without poisoning a valid alternative", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"x",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						durationMs: 1,
						id: "cycle-target",
						output: "target",
						allOf: [
							requirement("x"),
						],
					}),
					route({
						durationMs: 1,
						id: "cycle-x",
						output: "x",
						allOf: [
							requirement("target"),
						],
					}),
					route({
						durationMs: 20,
						id: "valid-target",
						output: "target",
						allOf: [
							requirement("root"),
						],
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 20,
			obtainable: true,
			route: {
				routeId: "valid-target",
			},
		});
		expect(
			result.rejectedRoutes.some(({ diagnostics }) =>
				diagnostics.some(({ kind }) => kind === "cycle"),
			),
		).toBe(true);
	});

	it("returns route diagnostics when every path is unreachable", () => {
		const result = estimate(
			graph({
				facts: [
					"missing",
					"target",
				],
				roots: [],
				routes: [
					route({
						durationMs: 10,
						id: "dead-end",
						output: "target",
						allOf: [
							requirement("missing"),
						],
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			factId: "target",
			obtainable: false,
		});
		expect(result.rejectedRoutes).toContainEqual(
			expect.objectContaining({
				routeId: "dead-end",
			}),
		);
	});

	it("uses stable route identity to break complete-duration ties", () => {
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
						durationMs: 10,
						id: "z-route",
						output: "target",
						allOf: [
							requirement("root"),
						],
					}),
					route({
						durationMs: 10,
						id: "a-route",
						output: "target",
						allOf: [
							requirement("root"),
						],
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

		const impossible: EditorEstimateDependencyGraph = {
			...stochastic,
			routes: [
				{
					...stochastic.routes[0]!,
					id: "zero-yield",
					output: {
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
		expect(unreachable.rejectedRoutes[0]?.diagnostics).toContainEqual(
			expect.objectContaining({
				kind: "zero-yield",
				routeId: "zero-yield",
			}),
		);
	});

	it("acquires consumed and concurrently retained same-fact quantities separately", () => {
		const dependencyGraph: EditorEstimateDependencyGraph = {
			factIds: [
				"tool",
				"target",
			],
			limitations: [],
			roots: [
				{
					factId: "tool",
					quantity: 2,
				},
			],
			routes: [
				route({
					allOf: [
						requirement("tool", "consume"),
						requirement("tool", "ongoing"),
					],
					durationMs: 1,
					id: "use-and-keep",
					output: "target",
				}),
			],
		};
		const result = estimate(dependencyGraph);
		expect(result).toMatchObject({
			consumables: [
				{
					factId: "tool",
					quantity: 1,
				},
			],
			obtainable: true,
			ongoingRequirements: [
				{
					factId: "tool",
					quantity: 1,
				},
			],
			oneTimeRequirements: [],
		});
	});

	it("reuses a sibling prerequisite before a later serialized sibling consumes it", () => {
		const dependencyGraph = graph({
			facts: [
				"tool",
				"a",
				"b",
				"target",
			],
			roots: [],
			routes: [
				route({
					allOf: [
						requirement("tool", "one-time"),
					],
					durationMs: 1,
					id: "make-a",
					output: "a",
				}),
				route({
					allOf: [
						requirement("tool"),
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
		const result = estimate({
			...dependencyGraph,
			roots: [
				{
					factId: "tool",
					quantity: 1,
				},
			],
		});

		expect(result).toMatchObject({
			durationMs: 3,
			obtainable: true,
		});
	});

	it("spends one finite root pool across sibling demands and produces only the shared deficit", () => {
		const dependencyGraph = graph({
			facts: [
				"seed",
				"raw",
				"a",
				"b",
				"target",
			],
			roots: [
				"seed",
			],
			routes: [
				route({
					allOf: [
						requirement("seed"),
					],
					durationMs: 10,
					id: "make-raw",
					output: "raw",
				}),
				route({
					allOf: [
						requirement("raw", "consume", 2),
					],
					durationMs: 0,
					id: "make-a",
					output: "a",
				}),
				route({
					allOf: [
						requirement("raw", "consume", 2),
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
		const result = estimate({
			...dependencyGraph,
			roots: [
				...dependencyGraph.roots,
				{
					factId: "raw",
					quantity: 2,
				},
			],
		});

		expect(result).toMatchObject({
			durationMs: 20,
			obtainable: true,
		});
	});

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
		expect(result.route.requirements[0]?.acquisition?.routeId).toBe("x-batch");
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
		expect(result.route.requirements[0]?.acquisition?.routeId).toBe("x-via-y");
		expect(
			result.route.requirements[0]?.acquisition?.requirements[0]?.acquisition?.routeId,
		).toBe("y-via-z");
	});

	it("retracts stale requirements when later demand changes a nested route", () => {
		const result = estimate(
			graph({
				facts: [
					"p",
					"q",
					"x",
					"y",
					"target",
				],
				roots: [
					"p",
					"q",
				],
				routes: [
					route({
						allOf: [
							requirement("p"),
						],
						durationMs: 10,
						id: "x-small",
						output: "x",
					}),
					route({
						allOf: [
							requirement("q"),
						],
						durationMs: 30,
						id: "x-batch",
						output: "x",
						outputQuantity: 5,
					}),
					route({
						allOf: [
							requirement("x", "consume", 4),
						],
						durationMs: 0,
						id: "make-y",
						output: "y",
					}),
					route({
						allOf: [
							requirement("x"),
							requirement("y"),
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 30,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected switched route.");
		expect(result.consumables).toContainEqual({
			factId: "q",
			quantity: 1,
		});
		expect(result.consumables).not.toContainEqual(
			expect.objectContaining({
				factId: "p",
			}),
		);
	});

	it("falls back from a nested route that overbooks a finite shared root", () => {
		const dependencyGraph: EditorEstimateDependencyGraph = {
			...graph({
				facts: [
					"raw",
					"a",
					"b",
					"x",
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
						id: "x-bad",
						output: "x",
					}),
					route({
						durationMs: 10,
						id: "x-good",
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
			roots: [
				{
					factId: "raw",
					quantity: 1,
				},
			],
		};

		expect(estimate(dependencyGraph)).toMatchObject({
			durationMs: 10,
			obtainable: true,
		});
	});

	it("falls back per any-of clause without discarding another valid root choice", () => {
		const dependencyGraph: EditorEstimateDependencyGraph = {
			...graph({
				facts: [
					"x",
					"y",
					"target",
				],
				roots: [],
				routes: [
					route({
						allOf: [
							requirement("target"),
						],
						durationMs: 0,
						id: "cycle-x",
						output: "x",
					}),
					route({
						durationMs: 100,
						id: "make-y",
						output: "y",
						outputQuantity: 2,
					}),
					route({
						anyOf: [
							[
								requirement("x", "consume", 2),
								requirement("y", "consume", 2),
							],
							[
								requirement("x"),
							],
						],
						durationMs: 0,
						id: "make-target",
						output: "target",
					}),
				],
			}),
			roots: [
				{
					factId: "x",
					quantity: 1,
				},
			],
		};

		expect(estimate(dependencyGraph)).toMatchObject({
			durationMs: 100,
			obtainable: true,
		});
	});

	it("bootstraps a renewable cycle only when its component has an authored seed", () => {
		const dependencyGraph: EditorEstimateDependencyGraph = {
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

	it("does not fabricate supply from a seeded consumptive zero-net cycle", () => {
		const dependencyGraph: EditorEstimateDependencyGraph = {
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
		const dependencyGraph: EditorEstimateDependencyGraph = {
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
