import { Effect } from "effect";

import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type {
	PlannerStructuralBlockedRoute,
	PlannerStructuralReachability,
} from "~/editor/planner/PlannerStructuralReachability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readReachableAlternative = (
	graph: PlannerAcquisitionGraph,
	clause: ReadonlyArray<PlannerAcquisitionRequirement>,
) =>
	clause
		.filter((requirement) => graph.reachableItemIds.has(requirement.itemId))
		.sort(
			(left, right) =>
				(graph.depthByItemId.get(left.itemId) ?? Number.POSITIVE_INFINITY) -
					(graph.depthByItemId.get(right.itemId) ?? Number.POSITIVE_INFINITY) ||
				compareIds(left.itemId, right.itemId),
		)[0];

const readWitness = (graph: PlannerAcquisitionGraph, itemId: IdSchema.Type) => {
	const witnessItemIds: IdSchema.Type[] = [];
	const witnessRouteIds: string[] = [];
	const visitedItemIds = new Set<IdSchema.Type>();
	const visitedRouteIds = new Set<string>();

	const visit = (candidateItemId: IdSchema.Type) => {
		if (visitedItemIds.has(candidateItemId)) return;
		visitedItemIds.add(candidateItemId);
		const route = graph.witnessRouteByItemId.get(candidateItemId);
		if (route !== undefined) {
			for (const requirement of route.requirements.allOf) visit(requirement.itemId);
			for (const clause of route.requirements.anyOf) {
				const alternative = readReachableAlternative(graph, clause);
				if (alternative !== undefined) visit(alternative.itemId);
			}
			if (!visitedRouteIds.has(route.id)) {
				visitedRouteIds.add(route.id);
				witnessRouteIds.push(route.id);
			}
		}
		witnessItemIds.push(candidateItemId);
	};
	visit(itemId);
	return {
		witnessItemIds,
		witnessRouteIds,
	};
};

const readBlockedRoute = (
	graph: PlannerAcquisitionGraph,
	route: PlannerAcquisitionRoute,
): PlannerStructuralBlockedRoute => ({
	missingAllOfItemIds: [
		...new Set(
			route.requirements.allOf
				.filter((requirement) => !graph.reachableItemIds.has(requirement.itemId))
				.map(({ itemId }) => itemId),
		),
	].sort(compareIds),
	missingAnyOfItemIds: route.requirements.anyOf
		.filter(
			(clause) =>
				!clause.some((requirement) => graph.reachableItemIds.has(requirement.itemId)),
		)
		.map((clause) =>
			[
				...new Set(clause.map(({ itemId }) => itemId)),
			].sort(compareIds),
		)
		.sort((left, right) => compareIds(left.join("\u0000"), right.join("\u0000"))),
	outputItemId: route.output.itemId,
	routeId: route.id,
});

/**
 * Reads a structural certificate for one target from the optimistic acquisition graph.
 *
 * `reachable` is only a search hint. `no-finite-path` is a proof boundary: the target is absent
 * even after relaxing geometry, upper bounds, absence constraints, runtime ordering and concrete
 * identities, so the engine-backed search cannot produce it through a represented action.
 */
export const readPlannerStructuralReachabilityFx = Effect.fn("readPlannerStructuralReachabilityFx")(
	({
		graph,
		itemId,
	}: {
		readonly graph: PlannerAcquisitionGraph;
		readonly itemId: IdSchema.Type;
	}) =>
		Effect.sync((): PlannerStructuralReachability => {
			if (!graph.itemIds.has(itemId))
				return {
					itemId,
					type: "target-missing",
				};

			const depth = graph.depthByItemId.get(itemId);
			if (depth !== undefined) {
				const witness = readWitness(graph, itemId);
				return {
					depth,
					itemId,
					type: "reachable",
					...witness,
				};
			}

			const blockedRoutes: PlannerStructuralBlockedRoute[] = [];
			const sourceLessItemIds = new Set<IdSchema.Type>();
			const unreachableItemIds = new Set<IdSchema.Type>();
			const pending: IdSchema.Type[] = [
				itemId,
			];

			for (let index = 0; index < pending.length; index += 1) {
				const candidateItemId = pending[index];
				if (candidateItemId === undefined || unreachableItemIds.has(candidateItemId))
					continue;
				unreachableItemIds.add(candidateItemId);
				const routes = graph.routesByOutputItemId.get(candidateItemId) ?? [];
				if (routes.length === 0) {
					sourceLessItemIds.add(candidateItemId);
					continue;
				}

				for (const route of routes) {
					const blocked = readBlockedRoute(graph, route);
					blockedRoutes.push(blocked);
					pending.push(
						...blocked.missingAllOfItemIds,
						...blocked.missingAnyOfItemIds.flat(),
					);
				}
			}

			blockedRoutes.sort(
				(left, right) =>
					compareIds(left.outputItemId, right.outputItemId) ||
					compareIds(left.routeId, right.routeId),
			);
			const cycleComponentIds = [
				...new Set(
					[
						...unreachableItemIds,
					].flatMap((candidateItemId) => {
						const component = graph.componentByItemId.get(candidateItemId);
						return component?.cyclic === true
							? [
									component.id,
								]
							: [];
					}),
				),
			].sort(compareIds);

			return {
				blockedRoutes,
				cycleComponentIds,
				itemId,
				sourceLessItemIds: [
					...sourceLessItemIds,
				].sort(compareIds),
				type: "no-finite-path",
				unreachableItemIds: [
					...unreachableItemIds,
				].sort(compareIds),
			};
		}),
);
