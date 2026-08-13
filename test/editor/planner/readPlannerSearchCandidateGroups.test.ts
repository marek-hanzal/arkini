import { describe, expect, it } from "vitest";

import type { PlannerAcquisitionRoute } from "~/editor/planner/PlannerAcquisitionGraph";
import { isPlannerAcquisitionRouteReady } from "~/editor/planner/readPlannerSearchCandidateGroups";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const chargedItem = {
	charges: {
		amount: 10,
	},
	id: "charged-item",
} as ItemSchema.Type;

const makeRuntime = (remainingCharges: number): RuntimeSchema.Type =>
	({
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "runtime:charged-item",
				item: chargedItem,
				location: {
					position: {
						x: 0,
						y: 0,
					},
					scope: "board",
					space: 0,
				},
				quantity: 1,
				remainingCharges,
				revision: "revision:charged-item",
			},
		],
		jobs: [],
		jobQueue: [],
	}) as RuntimeSchema.Type;

const route = {
	action: {
		kind: "line",
		lineId: "line:spend",
		ownerItemId: "charged-item",
	},
	id: "route:spend",
	kind: "line-output",
	output: {
		expectedQuantity: 1,
		itemId: "result",
		maximumQuantity: 1,
		maximumQuantityProbability: 1,
		occurrenceProbability: 1,
		quantityDistribution: [
			{
				probability: 1,
				quantity: 1,
			},
		],
		resolutionId: "resolution:result",
		selection: "guaranteed",
		stochastic: false,
		witnessId: "witness:result",
	},
	requirements: {
		allOf: [
			{
				chargeCost: 2,
				itemId: "charged-item",
				minimumQuantity: 1,
				source: "charged-item",
				usage: "charge",
			},
			{
				chargeCost: 2,
				itemId: "charged-item",
				minimumQuantity: 1,
				source: "charged-item",
				usage: "charge",
			},
		],
		anyOf: [],
	},
} satisfies PlannerAcquisitionRoute;

describe("isPlannerAcquisitionRouteReady", () => {
	it("requires the complete aggregated charge spend, not only charged-item presence", () => {
		expect(isPlannerAcquisitionRouteReady(route, makeRuntime(3))).toBe(false);
		expect(isPlannerAcquisitionRouteReady(route, makeRuntime(4))).toBe(true);
	});
});
