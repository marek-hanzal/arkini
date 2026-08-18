import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { createEditorEstimatePolicyFx } from "~/editor/estimator/createEditorEstimatePolicyFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import { editorItemEstimateMaximumQuantity } from "~/editor/estimator/EditorItemEstimateQuantitySchema";

const requirement = (
	factId: string,
	usage: EditorAcquisitionRequirement["usage"] = "consume",
	quantity = 1,
	identity?: EditorAcquisitionRequirement["identity"],
): EditorAcquisitionRequirement => ({
	factId,
	...(identity === undefined
		? {}
		: {
				identity,
			}),
	quantity,
	source: "material-input",
	usage,
});

const route = ({
	allOf = [],
	anyOf = [],
	chargeUses,
	durationMs,
	id,
	operation,
	operationOutputGroupId,
	output,
	outputQuantity = 1,
	quantityDistribution,
}: {
	readonly allOf?: ReadonlyArray<EditorAcquisitionRequirement>;
	readonly anyOf?: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
	readonly chargeUses?: EditorAcquisitionRoute["chargeUses"];
	readonly durationMs: number;
	readonly id: string;
	readonly operation?: EditorAcquisitionRoute["operation"];
	readonly operationOutputGroupId?: string;
	readonly output: string;
	readonly outputQuantity?: number;
	readonly quantityDistribution?: EditorAcquisitionRoute["output"]["quantityDistribution"];
}): EditorAcquisitionRoute => ({
	...(chargeUses === undefined
		? {}
		: {
				chargeUses,
			}),
	durationMs,
	id,
	metadata: {
		kind: "line-output",
		lineId: id,
		lineTitle: id,
		ownerItemId: "owner",
	},
	...(operation === undefined
		? {}
		: {
				operation,
			}),
	output: {
		annotation: {
			alternativeSet: false,
			placement: "drop",
			quantity: {
				max: outputQuantity,
				min: outputQuantity,
			},
			selectionKind: "guaranteed",
		},
		factId: output,
		...(operationOutputGroupId === undefined
			? {}
			: {
					operationOutputGroupId,
				}),
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
	readonly routes: ReadonlyArray<EditorAcquisitionRoute>;
}): EditorAcquisitionGraph => ({
	factIds: facts,
	limitations: [],
	roots: roots.map((factId) => ({
		factId,
		quantity: "unbounded",
	})),
	routes,
});

const estimate = (dependencyGraph: EditorAcquisitionGraph, factId = "target", quantity = 1) =>
	Effect.runSync(
		estimateEditorItemFx({
			factId,
			graph: dependencyGraph,
			quantity,
		}),
	);

describe("estimateEditorItemFx", () => {
	it("bounds public requests before building an estimate policy", () => {
		const quantity = editorItemEstimateMaximumQuantity + 1;
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
					maximumQuantity: editorItemEstimateMaximumQuantity,
					quantity,
					source: "request",
				},
			],
			status: "partial",
		});
	});

	it("reports oversized authored dependency demand as partial", () => {
		const quantity = editorItemEstimateMaximumQuantity + 1;
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
					maximumQuantity: editorItemEstimateMaximumQuantity,
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
		if (result.obtainable) expect(result.route.requirements[0]?.acquisitionFactId).toBe("fast");
	});

	it("rejects an OR alternative that can only recur through the active target", () => {
		const result = estimate(
			graph({
				facts: [
					"root",
					"a",
					"x",
					"target",
				],
				roots: [
					"root",
				],
				routes: [
					route({
						allOf: [
							requirement("target"),
						],
						durationMs: 0,
						id: "make-a",
						output: "a",
					}),
					route({
						allOf: [
							requirement("root"),
						],
						durationMs: 10,
						id: "make-x",
						output: "x",
					}),
					route({
						anyOf: [
							[
								requirement("a"),
								requirement("x"),
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
		if (!result.obtainable) throw new Error("Expected external OR branch.");
		expect(result.route.requirements[0]?.acquisitionFactId).toBe("x");
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

	it("ignores rule conditions but retains hard route requirements", () => {
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
			durationMs: 10,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected optimistic conditioned route.");
		expect(result.route.requirements.map(({ factId }) => factId)).toEqual([
			"owner",
		]);
	});

	it("excludes ignored condition and charge edges from component membership", () => {
		const dependencyGraph = graph({
			facts: [
				"condition-root",
				"condition-dependent",
				"charge-root",
				"charge-dependent",
			],
			roots: [
				"condition-root",
				"charge-root",
			],
			routes: [
				route({
					allOf: [
						{
							factId: "condition-dependent",
							quantity: 1,
							source: "line-condition",
							usage: "ongoing",
						},
					],
					durationMs: 1,
					id: "condition-edge",
					output: "condition-root",
				}),
				route({
					allOf: [
						requirement("condition-root"),
					],
					durationMs: 1,
					id: "condition-back-edge",
					output: "condition-dependent",
				}),
				route({
					chargeUses: [
						{
							accounting: "single-payer-exact",
							payerFactId: "charge-dependent",
							usableActionRuns: 1,
						},
					],
					durationMs: 1,
					id: "charge-edge",
					output: "charge-root",
				}),
				route({
					allOf: [
						requirement("charge-root"),
					],
					durationMs: 1,
					id: "charge-back-edge",
					output: "charge-dependent",
				}),
			],
		});

		const policy = Effect.runSync(createEditorEstimatePolicyFx(dependencyGraph));

		expect(
			[
				...policy.seededComponentByFact.keys(),
			].sort(),
		).toEqual([
			"charge-root",
			"condition-root",
		]);
	});

	it("keeps charge-depletion output work while acquiring its payer once", () => {
		const depletionRoute: EditorAcquisitionRoute = {
			...route({
				allOf: [
					{
						factId: "payer",
						quantity: 1,
						source: "charged-item",
						usage: "consume",
					},
					requirement("material"),
				],
				durationMs: 10,
				id: "deplete-payer",
				output: "target",
			}),
			metadata: {
				chargedItemId: "payer",
				kind: "line-charge-depletion",
				lineId: "line",
				lineTitle: "Line",
				ownerItemId: "owner",
			},
			runMultiplier: 3,
		};
		const result = estimate(
			graph({
				facts: [
					"material",
					"payer",
					"target",
				],
				roots: [
					"material",
				],
				routes: [
					route({
						durationMs: 5,
						id: "acquire-payer",
						output: "payer",
					}),
					depletionRoute,
				],
			}),
		);

		expect(result).toMatchObject({
			durationMs: 35,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected depletion output route.");
		expect(result.route.actionRuns).toBe(3);
		expect(result.routeSteps.find(({ factId }) => factId === "payer")?.quantity).toBe(1);
	});

	it("requires two distinct identities for a self-merge without duplicating shared capabilities", () => {
		const selfMerge = route({
			allOf: [
				{
					...requirement("token", "one-time", 1, "distinct"),
					source: "merge-source",
				},
				{
					...requirement("token", "one-time", 1, "distinct"),
					source: "merge-target",
				},
				requirement("workbench", "one-time"),
				requirement("workbench", "one-time"),
			],
			durationMs: 0,
			id: "self-merge",
			output: "target",
		});
		const dependencyGraph: EditorAcquisitionGraph = {
			factIds: [
				"target",
				"token",
				"workbench",
			],
			limitations: [],
			roots: [
				{
					factId: "token",
					quantity: 1,
				},
				{
					factId: "workbench",
					quantity: 1,
				},
			],
			routes: [
				selfMerge,
			],
		};

		expect(estimate(dependencyGraph)).toMatchObject({
			obtainable: false,
			status: "unreachable",
		});
		const complete = estimate({
			...dependencyGraph,
			roots: dependencyGraph.roots.map((root) =>
				root.factId === "token"
					? {
							...root,
							quantity: 2,
						}
					: root,
			),
		});
		expect(complete).toMatchObject({
			obtainable: true,
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
	});

	it("rejects a nested cyclic route without hiding its slower complete alternative", () => {
		const result = estimate(
			graph({
				facts: [
					"x",
					"target",
				],
				roots: [],
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
						allOf: [
							requirement("target"),
						],
						durationMs: 1,
						id: "a-cyclic-x",
						output: "x",
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
			durationMs: 21,
			obtainable: true,
		});
		if (!result.obtainable) throw new Error("Expected nested complete route.");
		expect(result.routeSteps.find(({ factId }) => factId === "x")?.routeId).toBe(
			"z-complete-x",
		);
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

		const impossible: EditorAcquisitionGraph = {
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

	it("acquires consumed and concurrently retained same-fact quantities separately", () => {
		const dependencyGraph: EditorAcquisitionGraph = {
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
			obtainable: true,
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
		if (result.obtainable)
			expect(result.routeSteps.find(({ factId }) => factId === "x")?.routeId).toBe("x-batch");
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
		if (result.obtainable) {
			expect(result.routeSteps.find(({ factId }) => factId === "x")?.routeId).toBe("x-via-y");
			expect(result.routeSteps.find(({ factId }) => factId === "y")?.routeId).toBe("y-via-z");
		}
	});

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
