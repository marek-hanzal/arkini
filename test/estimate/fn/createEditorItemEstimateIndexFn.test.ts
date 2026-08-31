import { describe, expect, it } from "vitest";

import type { EstimateRouteStep } from "~/estimate-projection/type/EstimateProjection";
import type { EditorItemEstimate } from "~/estimate/type/EditorItemEstimate";
import { createEditorItemEstimateIndexFn } from "~/estimate/fn/createEditorItemEstimateIndexFn";

const stepFn = (factId: string, quantity: number): EstimateRouteStep => ({
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

const completeFn = (
	factId: string,
	routeSteps: ReadonlyArray<EstimateRouteStep>,
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
	route: routeSteps[0] ?? stepFn(factId, 1),
	routeSteps,
	status: "complete",
});

describe("createEditorItemEstimateIndexFn", () => {
	it("sums each selected fact quantity across every complete estimate", () => {
		const entries = createEditorItemEstimateIndexFn({
			estimates: new Map<string, EditorItemEstimate>([
				[
					"target",
					completeFn("target", [
						stepFn("target", 1),
						stepFn("water", 3),
						stepFn("wood", 2),
					]),
				],
				[
					"water",
					completeFn("water", [
						stepFn("water", 1),
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
		});

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

	it("orders non-ASCII item IDs by stable code units", () => {
		const estimates = new Map(
			[
				"ä-item",
				"z-item",
			].map((itemId) => [
				itemId,
				completeFn(itemId, []),
			]),
		);

		expect(
			createEditorItemEstimateIndexFn({
				estimates,
				itemIds: [
					"ä-item",
					"z-item",
				],
			}).map(({ itemId }) => itemId),
		).toEqual([
			"z-item",
			"ä-item",
		]);
	});
});
