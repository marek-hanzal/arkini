import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type {
	PlannerSearchAction,
	PlannerSearchScope,
	PlannerSearchUnsupportedRoute,
	PlannerSearchUnsupportedRouteReason,
} from "~/editor/planner/PlannerSearchScope";
import { readPlannerActionId } from "~/editor/planner/readPlannerActionId";
import { resolvePlannerRouteReachability } from "~/editor/planner/resolvePlannerRouteReachability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readUnsupportedReason = (
	route: PlannerAcquisitionRoute,
	stochasticActionIds: ReadonlySet<string>,
): PlannerSearchUnsupportedRouteReason | undefined => {
	if (stochasticActionIds.has(readPlannerActionId(route.action))) return "stochastic-output";
	if (route.kind === "line-charge-depletion") return "charge-depletion";
	if (route.kind === "temporary-expiry") return "temporary-expiry";
	return undefined;
};

const readTargetClosure = ({
	depthByItemId,
	graph,
	reachableRouteIds,
	targetItemId,
}: {
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly graph: PlannerAcquisitionGraph;
	readonly reachableRouteIds: ReadonlySet<string>;
	readonly targetItemId: IdSchema.Type;
}) => {
	const itemIds = new Set<IdSchema.Type>();
	const routeIds = new Set<string>();
	const routes: PlannerAcquisitionRoute[] = [];
	const pending: IdSchema.Type[] = [
		targetItemId,
	];

	for (let index = 0; index < pending.length; index += 1) {
		const itemId = pending[index];
		if (itemId === undefined || itemIds.has(itemId)) continue;
		itemIds.add(itemId);
		for (const route of graph.routesByOutputItemId.get(itemId) ?? []) {
			if (!reachableRouteIds.has(route.id) || routeIds.has(route.id)) continue;
			routeIds.add(route.id);
			routes.push(route);
			pending.push(...route.requirements.allOf.map((requirement) => requirement.itemId));
			for (const clause of route.requirements.anyOf)
				pending.push(
					...clause
						.filter((requirement) => depthByItemId.has(requirement.itemId))
						.map((requirement) => requirement.itemId),
				);
		}
	}

	routes.sort((left, right) => compareIds(left.id, right.id));
	return {
		itemIds,
		routes,
	};
};

const readSearchActions = ({
	routeDepthById,
	routes,
}: {
	readonly routeDepthById: ReadonlyMap<string, number>;
	readonly routes: ReadonlyArray<PlannerAcquisitionRoute>;
}) => {
	const byId = new Map<
		string,
		{
			action: PlannerSearchAction["action"];
			depth: number;
			outputItemIds: Set<IdSchema.Type>;
			routeIds: string[];
		}
	>();
	for (const route of routes) {
		const id = readPlannerActionId(route.action);
		const depth = routeDepthById.get(route.id) ?? Number.POSITIVE_INFINITY;
		const candidate = byId.get(id) ?? {
			action: route.action,
			depth,
			outputItemIds: new Set<IdSchema.Type>(),
			routeIds: [],
		};
		candidate.depth = Math.min(candidate.depth, depth);
		candidate.outputItemIds.add(route.output.itemId);
		candidate.routeIds.push(route.id);
		byId.set(id, candidate);
	}

	return [
		...byId,
	]
		.map(
			([id, candidate]): PlannerSearchAction => ({
				action: candidate.action,
				depth: candidate.depth,
				id,
				outputItemIds: [
					...candidate.outputItemIds,
				].sort(compareIds),
				routeIds: candidate.routeIds.sort(compareIds),
			}),
		)
		.sort((left, right) => left.depth - right.depth || compareIds(left.id, right.id));
};

/**
 * Reads the deterministic target-specific route slice supported by the first search milestone.
 *
 * Unsupported routes remain diagnostics, never structural impossibility proofs.
 */
export const readPlannerSearchScope = ({
	graph,
	targetItemId,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly targetItemId: IdSchema.Type;
}): PlannerSearchScope => {
	const stochasticActionIds = new Set(
		graph.routes
			.filter((route) => route.output.stochastic)
			.map((route) => readPlannerActionId(route.action)),
	);
	const supportedRoutes = graph.routes.filter(
		(route) => readUnsupportedReason(route, stochasticActionIds) === undefined,
	);
	const supportedReachability = resolvePlannerRouteReachability({
		rootItemIds: graph.rootItemIds,
		routes: supportedRoutes,
	});
	const supported = supportedReachability.depthByItemId.has(targetItemId);
	const supportedClosure = supported
		? readTargetClosure({
				depthByItemId: supportedReachability.depthByItemId,
				graph,
				reachableRouteIds: supportedReachability.reachableRouteIds,
				targetItemId,
			})
		: {
				itemIds: new Set<IdSchema.Type>(),
				routes: [] as PlannerAcquisitionRoute[],
			};
	const fullClosure = readTargetClosure({
		depthByItemId: graph.depthByItemId,
		graph,
		reachableRouteIds: graph.reachableRouteIds,
		targetItemId,
	});
	const unsupportedRoutes: PlannerSearchUnsupportedRoute[] = fullClosure.routes.flatMap(
		(route) => {
			const reason = readUnsupportedReason(route, stochasticActionIds);
			return reason === undefined
				? []
				: [
						{
							kind: route.kind,
							outputItemId: route.output.itemId,
							reason,
							routeId: route.id,
						},
					];
		},
	);

	return {
		actions: readSearchActions({
			routeDepthById: supportedReachability.routeDepthById,
			routes: supportedClosure.routes,
		}),
		itemIds: [
			...supportedClosure.itemIds,
		].sort(compareIds),
		routeIds: supportedClosure.routes.map((route) => route.id),
		supported,
		unsupportedRoutes,
	};
};
