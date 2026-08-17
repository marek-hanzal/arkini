import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerSearchPriorityPlan } from "~/editor/planner/PlannerSearchPriorityPlan";
import { readPlannerSearchCandidateGroupsFx } from "~/editor/planner/readPlannerSearchCandidateGroupsFx";
import type { PlannerSearchAction, PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
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

const chargedRoute = {
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
		resolutionId: "resolution:result:charged",
		selection: "guaranteed",
		stochastic: false,
		witnessId: "witness:result:charged",
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

const readyRoute = {
	...chargedRoute,
	action: {
		kind: "line",
		lineId: "line:ready",
		ownerItemId: "charged-item",
	},
	id: "route:ready",
	output: {
		...chargedRoute.output,
		resolutionId: "resolution:result:ready",
		witnessId: "witness:result:ready",
	},
	requirements: {
		allOf: [],
		anyOf: [],
	},
} satisfies PlannerAcquisitionRoute;

const action = (route: PlannerAcquisitionRoute): PlannerSearchAction => ({
	action: route.action,
	actionId: route.id,
	depth: 0,
	id: route.id,
	outputItemIds: [
		"result",
	],
	outputMode: "canonical",
	routeIds: [
		route.id,
	],
});

const graph = {
	routes: [
		chargedRoute,
		readyRoute,
	],
} as unknown as PlannerAcquisitionGraph;
const plan = {
	depthByItemId: new Map([
		[
			"result",
			0,
		],
	]),
} as unknown as PlannerSearchPriorityPlan;
const scope = {
	actions: [
		action(chargedRoute),
		action(readyRoute),
	],
} as unknown as PlannerSearchScope;
const activeDemand = new Map([
	[
		"result",
		{
			bootstrapQuantity: 1,
			projectedQuantity: 0,
			quantity: 1,
			requiredCharges: 0,
		},
	],
]);

const readGroups = (remainingCharges: number) =>
	Effect.runSync(
		readPlannerSearchCandidateGroupsFx({
			activeDemand,
			graph,
			plan,
			runtime: makeRuntime(remainingCharges),
			scope,
		}),
	);

describe("readPlannerSearchCandidateGroupsFx", () => {
	it("requires the complete aggregated charge spend, not only charged-item presence", () => {
		expect(readGroups(3)[0]?.actions.map(({ id }) => id)).toEqual([
			"route:ready",
		]);
		expect(readGroups(4)[0]?.actions.map(({ id }) => id)).toEqual([
			"route:spend",
			"route:ready",
		]);
	});
});
