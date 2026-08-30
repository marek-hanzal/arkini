import { describe, expect, it } from "vitest";

import type { EstimateRouteStep } from "~/estimate-projection/type/EstimateProjection";
import type { EditorItemEstimate } from "~/estimate/type/EditorItemEstimate";
import { createEditorItemEstimateIndexFn } from "~/estimate/fn/createEditorItemEstimateIndexFn";

const step = (factId: string, quantity: number): EstimateRouteStep => ({
	actionRuns: quantity,
	durationMs: quantity * 1_000,
	factId,
	occurrenceCount: 1,
	occurrenceId: `occurrence:${factId}:${quantity}`,
	outputRuns: quantity,
	quantity,
	requirements: [],
	rootQuantity: 0,
	routeId: `make:${factId}`,
	source: "route",
});

const complete = (
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
	route: routeSteps[0] ?? step(factId, 1),
	routeSteps,
	status: "complete",
});

describe("createEditorItemEstimateIndexFn", () => {
	it("sums each selected fact quantity across every complete estimate", () => {
		const entries = createEditorItemEstimateIndexFn({
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

	it("counts compressed equivalent route occurrences in global demand", () => {
		const repeatedWater = {
			...step("water", 3),
			occurrenceCount: 4,
		};
		const entries = createEditorItemEstimateIndexFn({
			estimates: new Map([
				[
					"target",
					complete("target", [
						step("target", 1),
						repeatedWater,
					]),
				],
				[
					"water",
					{
						diagnostics: [],
						factId: "water",
						limitations: [],
						obtainable: false,
						quantity: 1,
						status: "partial",
					} satisfies EditorItemEstimate,
				],
			]),
			itemIds: [
				"water",
			],
		});

		expect(entries[0]?.demand).toBe(12);
	});

	it("orders non-ASCII item IDs by stable code units", () => {
		const estimates = new Map(
			[
				"ä-item",
				"z-item",
			].map((itemId) => [
				itemId,
				complete(itemId, []),
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
