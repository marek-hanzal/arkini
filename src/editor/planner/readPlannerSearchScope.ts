import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type {
	PlannerSearchAction,
	PlannerSearchScope,
	PlannerSearchUnsupportedRoute,
} from "~/editor/planner/PlannerSearchScope";
import { readPlannerActionId } from "~/editor/planner/readPlannerActionId";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readTargetClosure = ({
	depthByItemId,
	graph,
	reachableRouteIds,
	routeDepthById,
	targetItemId,
}: {
	readonly depthByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly graph: PlannerAcquisitionGraph;
	readonly reachableRouteIds: ReadonlySet<string>;
	readonly routeDepthById: ReadonlyMap<string, number>;
	readonly targetItemId: IdSchema.Type;
}) => {
	const itemIds = new Set<IdSchema.Type>();
	const routeIds = new Set<string>();
	const routes: PlannerAcquisitionRoute[] = [];
	const pendingItemIds: IdSchema.Type[] = [
		targetItemId,
	];
	const pendingRenewalItemIds: IdSchema.Type[] = [];
	const queuedRenewalItemIds = new Set<IdSchema.Type>();

	const queueRequirement = (
		requirement: PlannerAcquisitionRoute["requirements"]["allOf"][number],
	) => {
		pendingItemIds.push(requirement.itemId);
		if (
			graph.rootItemIds.has(requirement.itemId) &&
			(requirement.usage === "charge" || requirement.usage === "consume") &&
			!queuedRenewalItemIds.has(requirement.itemId)
		) {
			queuedRenewalItemIds.add(requirement.itemId);
			pendingRenewalItemIds.push(requirement.itemId);
		}
	};

	const addRoute = (route: PlannerAcquisitionRoute) => {
		if (routeIds.has(route.id)) return;
		routeIds.add(route.id);
		routes.push(route);
		for (const requirement of route.requirements.allOf) queueRequirement(requirement);
		for (const clause of route.requirements.anyOf) {
			const minimumDepth = Math.min(
				...clause.flatMap((requirement) => {
					const depth = depthByItemId.get(requirement.itemId);
					return depth === undefined
						? []
						: [
								depth,
							];
				}),
			);
			for (const requirement of clause)
				if (depthByItemId.get(requirement.itemId) === minimumDepth)
					queueRequirement(requirement);
		}
	};

	let itemIndex = 0;
	let renewalIndex = 0;
	while (itemIndex < pendingItemIds.length || renewalIndex < pendingRenewalItemIds.length) {
		if (itemIndex < pendingItemIds.length) {
			const itemId = pendingItemIds[itemIndex];
			itemIndex += 1;
			if (itemId === undefined || itemIds.has(itemId)) continue;
			itemIds.add(itemId);
			const itemDepth = depthByItemId.get(itemId);
			if (itemDepth === undefined) continue;
			for (const route of graph.routesByOutputItemId.get(itemId) ?? [])
				if (reachableRouteIds.has(route.id) && routeDepthById.get(route.id) === itemDepth)
					addRoute(route);
			continue;
		}

		const itemId = pendingRenewalItemIds[renewalIndex];
		renewalIndex += 1;
		if (itemId === undefined) continue;
		const candidates = (graph.routesByOutputItemId.get(itemId) ?? []).filter(
			(route) =>
				reachableRouteIds.has(route.id) &&
				(routeDepthById.get(route.id) ?? Number.POSITIVE_INFINITY) > 0,
		);
		const minimumDepth = Math.min(
			...candidates.map((route) => routeDepthById.get(route.id) ?? Number.POSITIVE_INFINITY),
		);
		for (const route of candidates)
			if (routeDepthById.get(route.id) === minimumDepth) addRoute(route);
	}

	routes.sort((left, right) => compareIds(left.id, right.id));
	return {
		itemIds,
		routes,
	};
};

const readActionOutputWitness = (
	route: PlannerAcquisitionRoute,
): PlannerSearchAction["outputWitness"] => {
	const witness = route.output.witness;
	if (witness === undefined) return undefined;

	const source = (() => {
		switch (route.kind) {
			case "line-output":
				return {
					lineId: route.action.lineId,
					ownerItemId: route.action.ownerItemId,
					type: "line" as const,
				};
			case "line-charge-depletion":
				return {
					itemId: route.chargedItemId,
					type: "charges" as const,
				};
			case "merge-output":
				return {
					sourceItemId: route.action.sourceItemId,
					targetItemId: route.action.targetItemId,
					type: "merge" as const,
				};
			case "temporary-expiry":
				return {
					itemId: route.action.itemId,
					type: "temporary-expiry" as const,
				};
		}
	})();

	return {
		outputItemId: route.output.itemId,
		routeId: route.id,
		source,
		statistics: {
			expectedQuantity: route.output.expectedQuantity,
			maximumQuantity: route.output.maximumQuantity,
			maximumQuantityProbability: route.output.maximumQuantityProbability,
			occurrenceProbability: route.output.occurrenceProbability,
			quantityDistribution: route.output.quantityDistribution,
			selection: route.output.selection,
			stochastic: route.output.stochastic,
		},
		witness,
		witnessId: route.output.witnessId,
	};
};

const readSearchActions = ({
	routeDepthById,
	routes,
}: {
	readonly routeDepthById: ReadonlyMap<string, number>;
	readonly routes: ReadonlyArray<PlannerAcquisitionRoute>;
}) => {
	const canonicalByActionId = new Map<
		string,
		{
			action: PlannerSearchAction["action"];
			depth: number;
			outputItemIds: Set<IdSchema.Type>;
			routeIds: string[];
		}
	>();
	const existential: PlannerSearchAction[] = [];

	for (const route of routes) {
		const actionId = readPlannerActionId(route.action);
		const depth = routeDepthById.get(route.id) ?? Number.POSITIVE_INFINITY;
		if (!route.output.stochastic) {
			const candidate = canonicalByActionId.get(actionId) ?? {
				action: route.action,
				depth,
				outputItemIds: new Set<IdSchema.Type>(),
				routeIds: [],
			};
			candidate.depth = Math.min(candidate.depth, depth);
			candidate.outputItemIds.add(route.output.itemId);
			candidate.routeIds.push(route.id);
			canonicalByActionId.set(actionId, candidate);
			continue;
		}

		const outputWitness = readActionOutputWitness(route);
		if (outputWitness === undefined)
			throw new Error(`Stochastic planner route ${route.id} has no output witness.`);
		existential.push({
			action: route.action,
			actionId,
			depth,
			id: JSON.stringify([
				"output-witness",
				actionId,
				route.id,
			]),
			outputItemIds: [
				route.output.itemId,
			],
			outputMode: "existential",
			outputWitness,
			routeIds: [
				route.id,
			],
		});
	}

	const canonical = [
		...canonicalByActionId,
	].map(
		([actionId, candidate]): PlannerSearchAction => ({
			action: candidate.action,
			actionId,
			depth: candidate.depth,
			id: actionId,
			outputItemIds: [
				...candidate.outputItemIds,
			].sort(compareIds),
			outputMode: "canonical",
			routeIds: candidate.routeIds.sort(compareIds),
		}),
	);

	return [
		...canonical,
		...existential,
	].sort((left, right) => left.depth - right.depth || compareIds(left.id, right.id));
};

/**
 * Reads the minimum-depth authored route slice currently executable by planner search.
 *
 * Equal-depth alternatives remain available for runtime backtracking. Longer detours stay outside
 * this bounded search pass and therefore may only lead to an inconclusive result, never a forged
 * impossibility proof. Unsupported routes remain diagnostics, never structural proofs.
 */
export const readPlannerSearchScope = ({
	graph,
	targetItemId,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly targetItemId: IdSchema.Type;
}): PlannerSearchScope => {
	const supported = graph.depthByItemId.has(targetItemId);
	const supportedClosure = supported
		? readTargetClosure({
				depthByItemId: graph.depthByItemId,
				graph,
				reachableRouteIds: graph.reachableRouteIds,
				routeDepthById: graph.routeDepthById,
				targetItemId,
			})
		: {
				itemIds: new Set<IdSchema.Type>(),
				routes: [] as PlannerAcquisitionRoute[],
			};
	const unsupportedRoutes: PlannerSearchUnsupportedRoute[] = [];

	return {
		actions: readSearchActions({
			routeDepthById: graph.routeDepthById,
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
