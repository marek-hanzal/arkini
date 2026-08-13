import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type {
	PlannerSearchAction,
	PlannerSearchScope,
	PlannerSearchUnsupportedRoute,
} from "~/editor/planner/PlannerSearchScope";
import { readPlannerActionId } from "~/editor/planner/readPlannerActionId";
import { readPlannerRequirementClauseId } from "~/editor/planner/readPlannerRequirementClauseId";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

type PlannerSearchChoiceProfile = ReadonlyMap<string, number>;

interface PlannerSearchChoicePoint {
	readonly key: string;
	readonly optionCount: number;
	readonly selectedIndex: number;
}

interface PlannerSearchScopeBuild {
	readonly choiceIndexByKey: ReadonlyMap<string, number>;
	readonly choicePoints: ReadonlyArray<PlannerSearchChoicePoint>;
	readonly scope: PlannerSearchScope;
}

interface PendingItemGoal {
	readonly itemId: IdSchema.Type;
	readonly type: "acquisition" | "renewal";
}

const readRouteDepth = (graph: PlannerAcquisitionGraph, route: PlannerAcquisitionRoute) =>
	graph.routeDepthById.get(route.id) ?? Number.POSITIVE_INFINITY;

const compareRoutes = (
	graph: PlannerAcquisitionGraph,
	left: PlannerAcquisitionRoute,
	right: PlannerAcquisitionRoute,
) => readRouteDepth(graph, left) - readRouteDepth(graph, right) || compareIds(left.id, right.id);

const compareRequirements = (
	graph: PlannerAcquisitionGraph,
	left: PlannerAcquisitionRequirement,
	right: PlannerAcquisitionRequirement,
) =>
	(graph.depthByItemId.get(left.itemId) ?? Number.POSITIVE_INFINITY) -
		(graph.depthByItemId.get(right.itemId) ?? Number.POSITIVE_INFINITY) ||
	compareIds(left.itemId, right.itemId) ||
	compareIds(left.source, right.source) ||
	compareIds(left.usage, right.usage) ||
	left.minimumQuantity - right.minimumQuantity ||
	(left.inputIndex ?? -1) - (right.inputIndex ?? -1) ||
	(left.ruleIndex ?? -1) - (right.ruleIndex ?? -1) ||
	(left.whenIndex ?? -1) - (right.whenIndex ?? -1);

const readAcquisitionChoiceId = (itemId: IdSchema.Type) =>
	JSON.stringify([
		"acquisition-route",
		itemId,
	]);

const readRenewalChoiceId = (itemId: IdSchema.Type) =>
	JSON.stringify([
		"renewal-route",
		itemId,
	]);

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

const buildPlannerSearchScope = ({
	choiceProfile,
	graph,
	targetItemId,
}: {
	readonly choiceProfile: PlannerSearchChoiceProfile;
	readonly graph: PlannerAcquisitionGraph;
	readonly targetItemId: IdSchema.Type;
}): PlannerSearchScopeBuild | undefined => {
	const supported = graph.depthByItemId.has(targetItemId);
	const unsupportedRoutes: PlannerSearchUnsupportedRoute[] = [];
	if (!supported)
		return {
			choiceIndexByKey: new Map(),
			choicePoints: [],
			scope: {
				actions: [],
				depthDiscrepancy: 0,
				id: "[]",
				itemIds: [],
				maximumDetourDepth: 0,
				preferredRequirementByClauseId: new Map(),
				preferredRenewalRouteByItemId: new Map(),
				preferredRouteByItemId: new Map(),
				routeDiscrepancy: 0,
				routeIds: [],
				supported: false,
				unsupportedRoutes,
			},
		};

	const choiceIndexByKey = new Map<string, number>();
	const choicePoints: PlannerSearchChoicePoint[] = [];
	const itemIds = new Set<IdSchema.Type>();
	const preferredRequirementByClauseId = new Map<string, PlannerAcquisitionRequirement>();
	const preferredRenewalRouteByItemId = new Map<IdSchema.Type, PlannerAcquisitionRoute>();
	const preferredRouteByItemId = new Map<IdSchema.Type, PlannerAcquisitionRoute>();
	const routeIds = new Set<string>();
	const routes: PlannerAcquisitionRoute[] = [];
	const pendingGoals: PendingItemGoal[] = [
		{
			itemId: targetItemId,
			type: "acquisition",
		},
	];
	const processedGoalIds = new Set<string>();
	let depthDiscrepancy = 0;
	let maximumDetourDepth = 0;
	let routeDiscrepancy = 0;

	const registerChoice = ({
		depths,
		key,
		optionCount,
	}: {
		readonly depths: ReadonlyArray<number>;
		readonly key: string;
		readonly optionCount: number;
	}) => {
		const selectedIndex = choiceProfile.get(key) ?? 0;
		if (selectedIndex < 0 || selectedIndex >= optionCount) return undefined;
		if (!choiceIndexByKey.has(key)) {
			choiceIndexByKey.set(key, selectedIndex);
			choicePoints.push({
				key,
				optionCount,
				selectedIndex,
			});
			const detourDepth = (depths[selectedIndex] ?? 0) - (depths[0] ?? 0);
			depthDiscrepancy += detourDepth;
			maximumDetourDepth = Math.max(maximumDetourDepth, detourDepth);
			routeDiscrepancy += selectedIndex;
		}
		return selectedIndex;
	};

	const queueRequirement = (requirement: PlannerAcquisitionRequirement) => {
		itemIds.add(requirement.itemId);
		pendingGoals.push({
			itemId: requirement.itemId,
			type: "acquisition",
		});
		if (
			graph.rootItemIds.has(requirement.itemId) &&
			(requirement.usage === "charge" || requirement.usage === "consume")
		)
			pendingGoals.push({
				itemId: requirement.itemId,
				type: "renewal",
			});
	};

	const addRoute = (route: PlannerAcquisitionRoute) => {
		if (routeIds.has(route.id)) return true;
		routeIds.add(route.id);
		routes.push(route);
		for (const requirement of route.requirements.allOf) queueRequirement(requirement);
		for (const [clauseIndex, clause] of route.requirements.anyOf.entries()) {
			const options = clause
				.filter((requirement) => graph.depthByItemId.has(requirement.itemId))
				.sort((left, right) => compareRequirements(graph, left, right));
			if (options.length === 0) return false;
			const clauseId = readPlannerRequirementClauseId(route.id, clauseIndex);
			const selectedIndex = registerChoice({
				depths: options.map(
					(requirement) =>
						graph.depthByItemId.get(requirement.itemId) ?? Number.POSITIVE_INFINITY,
				),
				key: clauseId,
				optionCount: options.length,
			});
			if (selectedIndex === undefined) return false;
			const selected = options[selectedIndex];
			if (selected === undefined) return false;
			preferredRequirementByClauseId.set(clauseId, selected);
			const selectedDepth = graph.depthByItemId.get(selected.itemId);
			if (selectedDepth === undefined) return false;
			for (const requirement of options)
				if (
					(graph.depthByItemId.get(requirement.itemId) ?? Number.POSITIVE_INFINITY) <=
					selectedDepth
				)
					queueRequirement(requirement);
		}
		return true;
	};

	for (let goalIndex = 0; goalIndex < pendingGoals.length; goalIndex += 1) {
		const goal = pendingGoals[goalIndex];
		if (goal === undefined) continue;
		const goalId = JSON.stringify([
			goal.type,
			goal.itemId,
		]);
		if (processedGoalIds.has(goalId)) continue;
		processedGoalIds.add(goalId);
		itemIds.add(goal.itemId);
		if (goal.type === "acquisition" && graph.rootItemIds.has(goal.itemId)) continue;

		const options = (graph.routesByOutputItemId.get(goal.itemId) ?? [])
			.filter(
				(route) =>
					graph.reachableRouteIds.has(route.id) &&
					(goal.type !== "renewal" || readRouteDepth(graph, route) > 0),
			)
			.sort((left, right) => compareRoutes(graph, left, right));
		if (options.length === 0) continue;
		const choiceId =
			goal.type === "renewal"
				? readRenewalChoiceId(goal.itemId)
				: readAcquisitionChoiceId(goal.itemId);
		const selectedIndex = registerChoice({
			depths: options.map((route) => readRouteDepth(graph, route)),
			key: choiceId,
			optionCount: options.length,
		});
		if (selectedIndex === undefined) return undefined;
		const selected = options[selectedIndex];
		if (selected === undefined) return undefined;
		if (goal.type === "renewal") preferredRenewalRouteByItemId.set(goal.itemId, selected);
		else preferredRouteByItemId.set(goal.itemId, selected);
		const selectedDepth = readRouteDepth(graph, selected);
		for (const route of options) {
			if (readRouteDepth(graph, route) > selectedDepth) continue;
			if (!addRoute(route)) return undefined;
		}
	}

	routes.sort((left, right) => compareIds(left.id, right.id));
	const normalizedChoiceEntries = [
		...choiceIndexByKey,
	].sort(([left], [right]) => compareIds(left, right));
	return {
		choiceIndexByKey,
		choicePoints,
		scope: {
			actions: readSearchActions({
				routeDepthById: graph.routeDepthById,
				routes,
			}),
			depthDiscrepancy,
			id: JSON.stringify(normalizedChoiceEntries),
			itemIds: [
				...itemIds,
			].sort(compareIds),
			maximumDetourDepth,
			preferredRequirementByClauseId,
			preferredRenewalRouteByItemId,
			preferredRouteByItemId,
			routeDiscrepancy,
			routeIds: routes.map((route) => route.id),
			supported,
			unsupportedRoutes,
		},
	};
};

const compareScopeBuilds = (left: PlannerSearchScopeBuild, right: PlannerSearchScopeBuild) =>
	left.scope.depthDiscrepancy - right.scope.depthDiscrepancy ||
	left.scope.routeDiscrepancy - right.scope.routeDiscrepancy ||
	compareIds(left.scope.id, right.scope.id);

/** Reads the locally shortest route plan used by the first engine-backed search pass. */
export const readPlannerSearchScope = ({
	graph,
	targetItemId,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly targetItemId: IdSchema.Type;
}): PlannerSearchScope => {
	const build = buildPlannerSearchScope({
		choiceProfile: new Map(),
		graph,
		targetItemId,
	});
	if (build === undefined)
		throw new Error(`Planner could not build its minimum route scope for ${targetItemId}.`);
	return build.scope;
};

/**
 * Lazily enumerates route plans by structural discrepancy.
 *
 * Equal-depth alternatives are preferred before longer detours. Each yielded scope remains a
 * monotone authored slice, while its preferred route tree gives the demand-driven scheduler one
 * concrete path to pursue. Search budget, rather than graph size, bounds how many plans execute.
 */
export function* iteratePlannerSearchScopes({
	graph,
	targetItemId,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly targetItemId: IdSchema.Type;
}): Generator<PlannerSearchScope> {
	const initial = buildPlannerSearchScope({
		choiceProfile: new Map(),
		graph,
		targetItemId,
	});
	if (initial === undefined) return;
	const pending: PlannerSearchScopeBuild[] = [
		initial,
	];
	const queuedScopeIds = new Set<string>([
		initial.scope.id,
	]);

	while (pending.length > 0) {
		pending.sort(compareScopeBuilds);
		const current = pending.shift();
		if (current === undefined) continue;
		yield current.scope;

		for (const choice of current.choicePoints) {
			if (choice.selectedIndex + 1 >= choice.optionCount) continue;
			const nextProfile = new Map(current.choiceIndexByKey);
			nextProfile.set(choice.key, choice.selectedIndex + 1);
			const next = buildPlannerSearchScope({
				choiceProfile: nextProfile,
				graph,
				targetItemId,
			});
			if (next === undefined || queuedScopeIds.has(next.scope.id)) continue;
			queuedScopeIds.add(next.scope.id);
			pending.push(next);
		}
	}
}

/** Materializes all progressive scopes for diagnostics and focused tests. */
export const readPlannerSearchScopes = ({
	graph,
	targetItemId,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly targetItemId: IdSchema.Type;
}): ReadonlyArray<PlannerSearchScope> => [
	...iteratePlannerSearchScopes({
		graph,
		targetItemId,
	}),
];
