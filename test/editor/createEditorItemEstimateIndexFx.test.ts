import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEditorItemEstimateIndexFx } from "~/editor/createEditorItemEstimateIndexFx";
import type {
	EditorItemEstimate,
	EditorItemEstimateRouteStep,
} from "~/editor/estimator/EditorItemEstimate";

const step = (factId: string, quantity: number): EditorItemEstimateRouteStep => ({
	actionRuns: quantity,
	durationMs: quantity * 1_000,
	factId,
	outputRuns: quantity,
	quantity,
	requirements: [],
	rootQuantity: 0,
	routeId: `make:${factId}`,
	source: "route",
});

const complete = (
	factId: string,
	routeSteps: ReadonlyArray<EditorItemEstimateRouteStep>,
): EditorItemEstimate => ({
	diagnostics: [],
	durationMs: 1_000,
	factId,
	limitations: [],
	obtainable: true,
	requirementSummary: {
		consumed: [],
		oneTime: [],
		ongoing: [],
	},
	quantity: 1,
	route: routeSteps[0] ?? step(factId, 1),
	routeSteps,
	status: "complete",
});

describe("createEditorItemEstimateIndexFx", () => {
	it("sums each selected fact quantity across every complete estimate", () => {
		const entries = Effect.runSync(
			createEditorItemEstimateIndexFx({
				estimates: new Map<string, EditorItemEstimate>([
					[
						"target",
						complete("target", [
							step("target", 1),
							step("water", 3),
							step("wood", 2),
						]),
					],
					[
						"water",
						complete("water", [
							step("water", 1),
						]),
					],
					[
						"wood",
						{
							diagnostics: [],
							factId: "wood",
							limitations: [],
							obtainable: false,
							quantity: 1,
							status: "partial",
						},
					],
				]),
				itemIds: [
					"wood",
					"target",
					"water",
				],
			}),
		);

		expect(
			entries.map(({ demand, itemId }) => ({
				demand,
				itemId,
			})),
		).toEqual([
			{
				demand: 1,
				itemId: "target",
			},
			{
				demand: 4,
				itemId: "water",
			},
			{
				demand: 2,
				itemId: "wood",
			},
		]);
	});
});
