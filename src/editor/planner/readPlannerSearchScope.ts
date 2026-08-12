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
): PlannerSearchUnsupportedRouteReason | undefined => {
	if (route.kind === "line-charge-depletion") return "charge-depletion";
	if (route.kind === "temporary-expiry") return "temporary-expiry";
	return undefined;
};

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
	const pending: IdSchema.Type[] = [
		targetItemId,
	];

	for (let index = 0; index < pending.length; index += 1) {
		const itemId = pending[index];
		if (itemId === undefined || itemIds.has(itemId)) continue;
		itemIds.add(itemId);
		const itemDepth = depthByItemId.get(itemId);
		if (itemDepth === undefined) continue;
		for (const route of graph.routesByOutputItemId.get(itemId) ?? []) {
			if (
				!reachableRouteIds.has(route.id) ||
				routeDepthById.get(route.id) !== itemDepth ||
				routeIds.has(route.id)
			)
				continue;
			routeIds.add(route.id);
			routes.push(route);
			pending.push(...route.requirements.allOf.map((requirement) => requirement.itemId));
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
				pending.push(
					...clause
						.filter(
							(requirement) => depthByItemId.get(requirement.itemId) === minimumDepth,
						)
						.map((requirement) => requirement.itemId),
				);
			}
		}
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
	const supportedRoutes = graph.routes.filter(
		(route) => readUnsupportedReason(route) === undefined,
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
				routeDepthById: supportedReachability.routeDepthById,
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
		routeDepthById: graph.routeDepthById,
		targetItemId,
	});
	const unsupportedRoutes: PlannerSearchUnsupportedRoute[] = fullClosure.routes.flatMap(
		(route) => {
			const reason = readUnsupportedReason(route);
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
