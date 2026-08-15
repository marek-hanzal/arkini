import { Effect } from "effect";

import type { PlannerAcquisitionRoute } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerRouteReachability } from "~/editor/planner/PlannerRouteReachability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readRouteRequirementDepth = (
	route: PlannerAcquisitionRoute,
	depthByItemId: ReadonlyMap<IdSchema.Type, number>,
) => {
	const depths: number[] = [];
	for (const requirement of route.requirements.allOf) {
		const depth = depthByItemId.get(requirement.itemId);
		if (depth === undefined) return undefined;
		depths.push(depth);
	}
	for (const clause of route.requirements.anyOf) {
		const alternativeDepths = clause.flatMap((requirement) => {
			const depth = depthByItemId.get(requirement.itemId);
			return depth === undefined
				? []
				: [
						depth,
					];
		});
		if (alternativeDepths.length === 0) return undefined;
		depths.push(Math.min(...alternativeDepths));
	}
	return Math.max(0, ...depths);
};

/** Resolves optimistic monotone reachability for an explicit route subset. */
export const resolvePlannerRouteReachabilityFx = Effect.fn("resolvePlannerRouteReachabilityFx")(
	({
		rootItemIds,
		routes,
	}: {
		readonly rootItemIds: ReadonlySet<IdSchema.Type>;
		readonly routes: ReadonlyArray<PlannerAcquisitionRoute>;
	}) =>
		Effect.sync((): PlannerRouteReachability => {
			const depthByItemId = new Map<IdSchema.Type, number>();
			for (const itemId of rootItemIds) depthByItemId.set(itemId, 0);
			const witnessRouteByItemId = new Map<IdSchema.Type, PlannerAcquisitionRoute>();

			let changed = true;
			while (changed) {
				changed = false;
				for (const route of routes) {
					const requirementDepth = readRouteRequirementDepth(route, depthByItemId);
					if (requirementDepth === undefined) continue;
					const routeDepth = requirementDepth + 1;
					const outputItemId = route.output.itemId;
					const currentDepth = depthByItemId.get(outputItemId);
					const currentWitness = witnessRouteByItemId.get(outputItemId);
					if (
						rootItemIds.has(outputItemId) ||
						(currentDepth !== undefined && currentDepth < routeDepth) ||
						(currentDepth === routeDepth &&
							currentWitness !== undefined &&
							compareIds(currentWitness.id, route.id) <= 0)
					)
						continue;
					depthByItemId.set(outputItemId, routeDepth);
					witnessRouteByItemId.set(outputItemId, route);
					changed = true;
				}
			}

			const routeDepthById = new Map<string, number>();
			for (const route of routes) {
				const requirementDepth = readRouteRequirementDepth(route, depthByItemId);
				if (requirementDepth !== undefined)
					routeDepthById.set(route.id, requirementDepth + 1);
			}
			return {
				depthByItemId,
				reachableRouteIds: new Set(routeDepthById.keys()),
				routeDepthById,
				witnessRouteByItemId,
			};
		}),
);
