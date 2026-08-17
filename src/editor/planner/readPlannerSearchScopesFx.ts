import { Effect } from "effect";

import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type {
	PlannerSearchScope,
	PlannerSearchScopeChoice,
	PlannerSearchUnsupportedRoute,
} from "~/editor/planner/PlannerSearchScope";
import { readPlannerSearchActionsFx } from "~/editor/planner/readPlannerSearchActionsFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readRequirementClauseId = (routeId: string, clauseIndex: number) =>
	JSON.stringify([
		"route-requirement-clause",
		routeId,
		clauseIndex,
	]);

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

const buildPlannerSearchScopeFx = Effect.fn("readPlannerSearchScopesFx.buildPlannerSearchScopeFx")(
	function* ({
		choiceProfile,
		graph,
		targetItemId,
	}: {
		readonly choiceProfile: PlannerSearchChoiceProfile;
		readonly graph: PlannerAcquisitionGraph;
		readonly targetItemId: IdSchema.Type;
	}) {
		const supported = graph.depthByItemId.has(targetItemId);
		const unsupportedRoutes: PlannerSearchUnsupportedRoute[] = [];
		if (!supported)
			return {
				choiceIndexByKey: new Map(),
				choicePoints: [],
				scope: {
					actions: [],
					choices: [],
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
			} satisfies PlannerSearchScopeBuild;

		const choiceIndexByKey = new Map<string, number>();
		const choicePoints: PlannerSearchChoicePoint[] = [];
		const choices: PlannerSearchScopeChoice[] = [];
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
			const minimumDepth = depths[0] ?? 0;
			const selectedDepth = depths[selectedIndex] ?? minimumDepth;
			const depthExcess = selectedDepth - minimumDepth;
			if (!choiceIndexByKey.has(key)) {
				choiceIndexByKey.set(key, selectedIndex);
				choicePoints.push({
					key,
					optionCount,
					selectedIndex,
				});
				depthDiscrepancy += depthExcess;
				maximumDetourDepth = Math.max(maximumDetourDepth, depthExcess);
				routeDiscrepancy += selectedIndex;
			}
			return {
				depthExcess,
				minimumDepth,
				selectedDepth,
				selectedIndex,
			};
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
				const clauseId = readRequirementClauseId(route.id, clauseIndex);
				const selection = registerChoice({
					depths: options.map(
						(requirement) =>
							graph.depthByItemId.get(requirement.itemId) ?? Number.POSITIVE_INFINITY,
					),
					key: clauseId,
					optionCount: options.length,
				});
				if (selection === undefined) return false;
				const selected = options[selection.selectedIndex];
				if (selected === undefined) return false;
				choices.push({
					alternativeCount: options.length,
					alternativeIndex: selection.selectedIndex,
					clauseId,
					depthExcess: selection.depthExcess,
					itemId: selected.itemId,
					key: clauseId,
					minimumDepth: selection.minimumDepth,
					selectedDepth: selection.selectedDepth,
					source: selected.source,
					type: "requirement",
					usage: selected.usage,
				});
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
			const selection = registerChoice({
				depths: options.map((route) => readRouteDepth(graph, route)),
				key: choiceId,
				optionCount: options.length,
			});
			if (selection === undefined) return undefined;
			const selected = options[selection.selectedIndex];
			if (selected === undefined) return undefined;
			choices.push({
				alternativeCount: options.length,
				alternativeIndex: selection.selectedIndex,
				depthExcess: selection.depthExcess,
				itemId: goal.itemId,
				key: choiceId,
				minimumDepth: selection.minimumDepth,
				routeId: selected.id,
				selectedDepth: selection.selectedDepth,
				type: goal.type === "renewal" ? "renewal-route" : "acquisition-route",
			});
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
				actions: yield* readPlannerSearchActionsFx({
					graph,
					routes,
				}),
				choices: choices.sort((left, right) => compareIds(left.key, right.key)),
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
		} satisfies PlannerSearchScopeBuild;
	},
);
const compareScopeBuilds = (left: PlannerSearchScopeBuild, right: PlannerSearchScopeBuild) =>
	left.scope.depthDiscrepancy - right.scope.depthDiscrepancy ||
	left.scope.routeDiscrepancy - right.scope.routeDiscrepancy ||
	compareIds(left.scope.id, right.scope.id);

/**
 * Materializes progressive route scopes in discrepancy order.
 *
 * Production may cap the result at its route-plan budget; focused diagnostics may omit the cap.
 */
export const readPlannerSearchScopesFx = Effect.fn("readPlannerSearchScopesFx")(function* ({
	graph,
	maximumScopes = Number.POSITIVE_INFINITY,
	targetItemId,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly maximumScopes?: number;
	readonly targetItemId: IdSchema.Type;
}): Effect.fn.Return<ReadonlyArray<PlannerSearchScope>> {
	if (maximumScopes <= 0) return [] as ReadonlyArray<PlannerSearchScope>;
	const initial = yield* buildPlannerSearchScopeFx({
		choiceProfile: new Map(),
		graph,
		targetItemId,
	});
	if (initial === undefined) return [] as ReadonlyArray<PlannerSearchScope>;
	const pending: PlannerSearchScopeBuild[] = [
		initial,
	];
	const queuedScopeIds = new Set<string>([
		initial.scope.id,
	]);
	const scopes: PlannerSearchScope[] = [];

	while (pending.length > 0 && scopes.length < maximumScopes) {
		pending.sort(compareScopeBuilds);
		const current = pending.shift();
		if (current === undefined) continue;
		scopes.push(current.scope);

		for (const choice of current.choicePoints) {
			if (choice.selectedIndex + 1 >= choice.optionCount) continue;
			const nextProfile = new Map(current.choiceIndexByKey);
			nextProfile.set(choice.key, choice.selectedIndex + 1);
			const next = yield* buildPlannerSearchScopeFx({
				choiceProfile: nextProfile,
				graph,
				targetItemId,
			});
			if (next === undefined || queuedScopeIds.has(next.scope.id)) continue;
			queuedScopeIds.add(next.scope.id);
			pending.push(next);
		}
	}
	return scopes;
});
