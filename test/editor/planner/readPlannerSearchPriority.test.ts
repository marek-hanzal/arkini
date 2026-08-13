import { describe, expect, it } from "vitest";

import {
	comparePlannerSearchPriority,
	readPlannerSearchPriority,
	type PlannerSearchPriorityPlan,
} from "~/editor/planner/readPlannerSearchPriority";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const water = {
	id: "item:water",
} as ItemSchema.Type;

const plan: PlannerSearchPriorityPlan = {
	depthByItemId: new Map([
		[
			water.id,
			4,
		],
	]),
	maximumSingleActionOutputByItemId: new Map([
		[
			water.id,
			3,
		],
	]),
	renewalRouteByItemId: new Map(),
	witnessRouteByItemId: new Map(),
};

const scope: PlannerSearchScope = {
	actions: [],
	itemIds: [
		water.id,
	],
	routeIds: [],
	supported: true,
	unsupportedRoutes: [],
};

const makeRuntime = (quantity: number): RuntimeSchema.Type =>
	({
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "runtime:water",
				item: water,
				location: {
					position: {
						x: 0,
						y: 0,
					},
					scope: "board",
					space: 0,
				},
				quantity,
				revision: "revision:water",
			},
		],
		jobs: [],
		jobQueue: [],
	}) as RuntimeSchema.Type;

const readPriority = (quantity: number) =>
	readPlannerSearchPriority({
		itemId: water.id,
		plan,
		quantity: 2,
		runtime: makeRuntime(quantity),
		scope,
	});

describe("readPlannerSearchPriority", () => {
	it("prefers one useful authored-output surplus without rewarding unbounded stockpiling", () => {
		const exact = readPriority(2);
		const oneActionMaximum = readPriority(3);
		const stockpile = readPriority(100);

		expect(exact.preferredProgressByDepth[4]).toBe(1);
		expect(oneActionMaximum.preferredProgressByDepth[4]).toBe(1);
		expect(exact.preferredHeadroomByDepth[4] ?? 0).toBe(0);
		expect(oneActionMaximum.preferredHeadroomByDepth[4]).toBe(1);
		expect(stockpile.preferredHeadroomByDepth[4]).toBe(1);
		expect(comparePlannerSearchPriority(oneActionMaximum, exact)).toBeLessThan(0);
		expect(comparePlannerSearchPriority(stockpile, oneActionMaximum)).toBe(0);
	});
});
