import { describe, expect, it } from "vitest";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRoute,
} from "~/flow/type/EditorAcquisitionGraph";

import { editorItemEstimateTestFixture } from "~test/estimate/fn/editorItemEstimateTestFixture";

const { estimate, graph, requirement, route } = editorItemEstimateTestFixture;

describe("estimateEditorItemsFn", () => {
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
