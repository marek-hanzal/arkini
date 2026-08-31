import { describe, expect, it } from "vitest";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRoute,
} from "~/flow/type/EditorAcquisitionGraph";
import { createEstimateTopologyFn } from "~/estimate/fn/createEstimateTopologyFn";

import { editorItemEstimateTestFixture } from "~test/estimate/fn/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemsFn", () => {
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

		const topology = createEstimateTopologyFn(dependencyGraph);

		const seededComponents = new Map(
			[
				"condition-root",
				"condition-dependent",
				"charge-root",
				"charge-dependent",
			].map((factId) => [
				factId,
				topology.seededComponentByFact.get(factId),
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
