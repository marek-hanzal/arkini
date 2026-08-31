import { describe, expect, it } from "vitest";

import type { EstimateRequirementGroup } from "~/estimate/fn/groupEstimateRequirementsFn";
import { projectEstimateWitnessFn } from "~/estimate/fn/projectEstimateWitnessFn";
import type { EstimateSelectedRoute } from "~/estimate/type/EstimateWitness";
import type { AcquisitionRoute } from "~/flow/type/AcquisitionGraph";

const groupFn = (factId: string): EstimateRequirementGroup => ({
	consumed: 0,
	distinctOneTime: 0,
	factId,
	oneTime: 1,
	ongoing: 0,
	sources: [
		"material-input",
	],
});

const selectedRouteFn = (
	factId: string,
	durationMs: number,
	groups: ReadonlyArray<EstimateRequirementGroup>,
): EstimateSelectedRoute => {
	const route: AcquisitionRoute = {
		durationMs,
		id: `make-${factId}`,
		metadata: {
			itemId: factId,
			kind: "temporary-expiry",
		},
		output: {
			annotation: {
				alternativeSet: false,
				placement: undefined,
				quantity: {
					max: 1,
					min: 1,
				},
				selectionKind: "guaranteed",
			},
			factId,
			quantityDistribution: [
				{
					probability: 1,
					quantity: 1,
				},
			],
		},
		runMultiplier: 1,
		requirements: {
			allOf: [],
			anyOf: [],
		},
	};
	return {
		actionRuns: 1,
		groups,
		outputRuns: 1,
		producedQuantity: 1,
		recurrenceFactIds: new Set(),
		route,
	};
};

describe("projectEstimateWitnessFn", () => {
	it("projects one normalized fact DAG and times its parallel critical path", () => {
		const projection = projectEstimateWitnessFn({
			consumedByFact: new Map(),
			dependenciesByFact: new Map([
				[
					"target",
					new Set([
						"a",
						"b",
					]),
				],
				[
					"a",
					new Set([
						"tool",
					]),
				],
				[
					"b",
					new Set([
						"tool",
					]),
				],
				[
					"tool",
					new Set(),
				],
			]),
			factId: "target",
			oneTimeByFact: new Map([
				[
					"tool",
					1,
				],
			]),
			ongoingByFact: new Map(),
			quantity: 1,
			requiredQuantityByFact: new Map(
				[
					"target",
					"a",
					"b",
					"tool",
				].map((factId) => [
					factId,
					1,
				]),
			),
			selectedByFact: new Map([
				[
					"target",
					selectedRouteFn("target", 0, [
						groupFn("a"),
						groupFn("b"),
					]),
				],
				[
					"a",
					selectedRouteFn("a", 100, [
						groupFn("tool"),
					]),
				],
				[
					"b",
					selectedRouteFn("b", 1, [
						groupFn("tool"),
					]),
				],
				[
					"tool",
					selectedRouteFn("tool", 50, []),
				],
			]),
			sharedOperationIds: new Set(),
			topRouteId: "make-target",
		});

		expect(projection.durationMs).toBe(150);
		expect(projection.routeSteps.map(({ factId }) => factId)).toEqual([
			"target",
			"a",
			"b",
			"tool",
		]);
		expect(projection.routeSteps.filter(({ factId }) => factId === "tool")).toHaveLength(1);
		expect(
			projection.routeSteps.find(({ factId }) => factId === "a")?.requirements[0],
		).toMatchObject({
			acquisitionFactId: "tool",
		});
		expect(
			projection.routeSteps.find(({ factId }) => factId === "b")?.requirements[0],
		).toMatchObject({
			acquisitionFactId: "tool",
		});
	});
});
