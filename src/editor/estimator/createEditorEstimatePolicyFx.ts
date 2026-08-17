import { Effect } from "effect";

import type {
	EditorEstimateDependencyGraph,
	EditorEstimateQuantityProbability,
	EditorEstimateRequirement,
	EditorEstimateRoute,
} from "~/editor/estimator/EditorEstimateDependencyGraph";
import { createEditorEstimateComponentIndexFx } from "~/editor/estimator/createEditorEstimateComponentIndexFx";

export interface EditorEstimateRequirementGroup {
	readonly anyOfClauseIndexes: number[];
	consumed: number;
	readonly factId: string;
	oneTime: number;
	ongoing: number;
}

export interface EditorEstimatePolicy {
	readonly factIds: ReadonlySet<string>;
	readonly roots: ReadonlyMap<string, number | "unbounded">;
	readonly seededComponentByFact: ReadonlyMap<string, string>;
	readonly routesByFact: ReadonlyMap<string, ReadonlyArray<EditorEstimateRoute>>;
	readonly unitCost: ReadonlyMap<string, number>;
	readonly chooseRequirements: (
		route: EditorEstimateRoute,
		actionRuns: number,
		excludedAnyOfFactIdsByClause?: ReadonlyMap<number, ReadonlySet<string>>,
	) => ReadonlyArray<EditorEstimateRequirementGroup> | undefined;
	readonly readExpectedRuns: (
		distribution: ReadonlyArray<EditorEstimateQuantityProbability>,
		quantity: number,
	) => number;
	readonly readRouteCost: (route: EditorEstimateRoute, quantity: number) => number;
}

const readEditorEstimateExpectedRuns = (
	distribution: ReadonlyArray<EditorEstimateQuantityProbability>,
	quantity: number,
) => {
	if (quantity <= 0) return 0;
	const expectedYield = distribution.reduce(
		(total, entry) => total + entry.probability * entry.quantity,
		0,
	);
	if (expectedYield <= 1e-12) return Number.POSITIVE_INFINITY;
	return distribution.length === 1 && distribution[0]?.probability === 1
		? Math.ceil(quantity / distribution[0].quantity)
		: quantity / expectedYield;
};

export const createEditorEstimatePolicyFx = Effect.fn("createEditorEstimatePolicyFx")(
	(graph: EditorEstimateDependencyGraph) =>
		Effect.gen(function* () {
			const roots = new Map(
				graph.roots.map(({ factId, quantity }) => [
					factId,
					quantity,
				]),
			);
			const routesByFact = new Map<string, EditorEstimateRoute[]>();
			for (const route of graph.routes) {
				const routes = routesByFact.get(route.output.factId) ?? [];
				routes.push(route);
				routesByFact.set(route.output.factId, routes);
			}
			for (const routes of routesByFact.values())
				routes.sort((a, b) => a.id.localeCompare(b.id));
			const { componentByFact, seededComponentByFact, seededComponentIds } =
				yield* createEditorEstimateComponentIndexFx(graph);

			const unitCost = new Map<string, number>();
			for (const { factId } of graph.roots) unitCost.set(factId, 0);
			for (let iteration = 0; iteration < graph.factIds.length; iteration += 1) {
				let changed = false;
				for (const route of graph.routes) {
					const runs =
						readEditorEstimateExpectedRuns(route.output.quantityDistribution, 1) *
						route.runMultiplier;
					if (!Number.isFinite(runs)) continue;
					let cost = route.durationMs * runs;
					let complete = true;
					for (const requirement of route.requirements.allOf) {
						const dependency = unitCost.get(requirement.factId);
						if (dependency === undefined) {
							complete = false;
							break;
						}
						cost +=
							dependency *
							requirement.quantity *
							(requirement.usage === "consume" ? runs : 1);
					}
					for (const clause of route.requirements.anyOf) {
						const best = Math.min(
							...clause.map((requirement) => {
								const dependency = unitCost.get(requirement.factId);
								return dependency === undefined
									? Number.POSITIVE_INFINITY
									: dependency *
											requirement.quantity *
											(requirement.usage === "consume" ? runs : 1);
							}),
						);
						if (!Number.isFinite(best)) {
							complete = false;
							break;
						}
						cost += best;
					}
					const current = unitCost.get(route.output.factId);
					if (complete && (current === undefined || cost < current - 1e-9)) {
						unitCost.set(route.output.factId, cost);
						changed = true;
					}
				}
				if (!changed) break;
			}

			const requirementAmount = (
				requirement: EditorEstimateRequirement,
				actionRuns: number,
			) => requirement.quantity * (requirement.usage === "consume" ? actionRuns : 1);
			const factCostMemo = new Map<string, number>();
			function readFactCost(
				factId: string,
				quantity: number,
				activeComponents: ReadonlySet<string>,
			): number {
				const root = roots.get(factId);
				const missing = root === "unbounded" ? 0 : Math.max(0, quantity - (root ?? 0));
				if (missing <= 1e-9) return 0;
				const componentId = componentByFact.get(factId) ?? factId;
				if (activeComponents.has(componentId))
					return seededComponentIds.has(componentId)
						? (unitCost.get(factId) ?? Number.POSITIVE_INFINITY) * missing
						: Number.POSITIVE_INFINITY;
				const normalized = Math.round(missing * 1e9) / 1e9;
				const key = `${factId}\u0000${normalized}`;
				const memoized = factCostMemo.get(key);
				if (memoized !== undefined) return memoized;
				const nextComponents = new Set(activeComponents).add(componentId);
				const cost = Math.min(
					...(routesByFact.get(factId) ?? []).map((route) =>
						readRouteCostInternal(route, missing, nextComponents),
					),
				);
				factCostMemo.set(key, cost);
				return cost;
			}

			function chooseRequirements(
				route: EditorEstimateRoute,
				actionRuns: number,
				excludedAnyOfFactIdsByClause: ReadonlyMap<number, ReadonlySet<string>> = new Map(),
				activeComponents: ReadonlySet<string> = new Set([
					componentByFact.get(route.output.factId) ?? route.output.factId,
				]),
			) {
				const requirements: Array<{
					readonly clauseIndex?: number;
					readonly requirement: EditorEstimateRequirement;
				}> = route.requirements.allOf.map((requirement) => ({
					requirement,
				}));
				for (const [clauseIndex, clause] of route.requirements.anyOf.entries()) {
					const selected = [
						...clause,
					]
						.filter(
							({ factId }) =>
								unitCost.has(factId) &&
								!excludedAnyOfFactIdsByClause.get(clauseIndex)?.has(factId),
						)
						.sort((left, right) => {
							return (
								readFactCost(
									left.factId,
									requirementAmount(left, actionRuns),
									activeComponents,
								) -
									readFactCost(
										right.factId,
										requirementAmount(right, actionRuns),
										activeComponents,
									) || left.factId.localeCompare(right.factId)
							);
						})[0];
					if (selected === undefined) return undefined;
					requirements.push({
						clauseIndex,
						requirement: selected,
					});
				}
				const groups = new Map<string, EditorEstimateRequirementGroup>();
				for (const { clauseIndex, requirement } of requirements) {
					const group = groups.get(requirement.factId) ?? {
						anyOfClauseIndexes: [],
						consumed: 0,
						factId: requirement.factId,
						oneTime: 0,
						ongoing: 0,
					};
					if (requirement.usage === "consume")
						group.consumed += requirement.quantity * actionRuns;
					if (requirement.usage === "one-time")
						group.oneTime = Math.max(group.oneTime, requirement.quantity);
					if (requirement.usage === "ongoing")
						group.ongoing = Math.max(group.ongoing, requirement.quantity);
					if (clauseIndex !== undefined) group.anyOfClauseIndexes.push(clauseIndex);
					groups.set(group.factId, group);
				}
				return [
					...groups.values(),
				].sort((a, b) => a.factId.localeCompare(b.factId));
			}
			function readRouteCostInternal(
				route: EditorEstimateRoute,
				quantity: number,
				activeComponents: ReadonlySet<string> = new Set([
					componentByFact.get(route.output.factId) ?? route.output.factId,
				]),
			) {
				const outputRuns = readEditorEstimateExpectedRuns(
					route.output.quantityDistribution,
					quantity,
				);
				if (!Number.isFinite(outputRuns)) return Number.POSITIVE_INFINITY;
				const groups = chooseRequirements(
					route,
					outputRuns * route.runMultiplier,
					new Map(),
					activeComponents,
				);
				if (groups === undefined) return Number.POSITIVE_INFINITY;
				return groups.reduce(
					(cost, group) => {
						const dependencyCost = readFactCost(
							group.factId,
							group.consumed + Math.max(group.oneTime, group.ongoing),
							activeComponents,
						);
						return cost + dependencyCost;
					},
					route.durationMs * outputRuns * route.runMultiplier,
				);
			}
			const routeCostMemo = new Map<string, number>();
			const readRouteCost = (route: EditorEstimateRoute, quantity: number) => {
				const normalized = Math.round(quantity * 1e9) / 1e9;
				const key = `${route.id}\u0000${normalized}`;
				const memoized = routeCostMemo.get(key);
				if (memoized !== undefined) return memoized;
				const cost = readRouteCostInternal(
					route,
					quantity,
					new Set([
						componentByFact.get(route.output.factId) ?? route.output.factId,
					]),
				);
				routeCostMemo.set(key, cost);
				return cost;
			};
			return {
				chooseRequirements,
				factIds: new Set(graph.factIds),
				readExpectedRuns: readEditorEstimateExpectedRuns,
				readRouteCost,
				roots,
				routesByFact,
				seededComponentByFact,
				unitCost,
			};
		}),
);
