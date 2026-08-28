import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { createEditorEstimatePolicyFx } from "~/editor/estimator/createEditorEstimatePolicyFx";

import { editorItemEstimateTestFixture } from "~test/editor/estimator/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemFx", () => {
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

	it("excludes ignored disable-condition and charge edges from component membership", () => {
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
					anyOf: [
						[
							{
								factId: "condition-dependent",
								quantity: 1,
								source: "line-condition",
								usage: "ongoing",
							},
						],
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

		const seededComponents = new Map(
			[
				"condition-root",
				"condition-dependent",
				"charge-root",
				"charge-dependent",
			].map((factId) => [
				factId,
				Effect.runSync(policy.readSeededComponentFx(factId)),
			]),
		);
		expect(seededComponents.get("condition-root")).toBeDefined();
		expect(seededComponents.get("charge-root")).toBeDefined();
		expect(seededComponents.get("condition-dependent")).toBeUndefined();
		expect(seededComponents.get("charge-dependent")).toBeUndefined();
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
});
