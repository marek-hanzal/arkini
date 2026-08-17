import { Effect } from "effect";

import type { EditorEstimatePolicy } from "~/editor/estimator/createEditorEstimatePolicyFx";
import type {
	EditorItemEstimateDiagnostic,
	EditorItemEstimateRejectedRoute,
} from "~/editor/estimator/EditorItemEstimate";
import type { EditorEstimateSelectedRoute } from "~/editor/estimator/projectEditorEstimateRouteStepFx";

export interface EditorEstimateFallbackChoices {
	readonly excludedRouteIds: ReadonlySet<string>;
	readonly rejectedRoutes: ReadonlyArray<EditorItemEstimateRejectedRoute>;
	readonly addRejectedRoute: (routeId: string, diagnostic: EditorItemEstimateDiagnostic) => void;
	readonly excludeAnyOf: (routeId: string, clauseIndex: number, factId: string) => void;
	readonly readAnyOfExclusions: (routeId: string) => Map<number, Set<string>>;
	readonly rejectFallbackChoice: (
		failedId: string,
		diagnostic: EditorItemEstimateDiagnostic,
		selected: ReadonlyMap<string, EditorEstimateSelectedRoute>,
	) => boolean;
}

/** Creates candidate exclusions retained while one demand closure retries fallbacks. */
export const createEditorEstimateFallbackChoicesFx = Effect.fn(
	"createEditorEstimateFallbackChoicesFx",
)(({ factId, policy }: { readonly factId: string; readonly policy: EditorEstimatePolicy }) =>
	Effect.sync((): EditorEstimateFallbackChoices => {
		const excludedRouteIds = new Set<string>();
		const excludedAnyOfByRouteId = new Map<string, Map<number, Set<string>>>();
		const rejectedRoutes: EditorItemEstimateRejectedRoute[] = [];
		const readAnyOfExclusions = (routeId: string) =>
			excludedAnyOfByRouteId.get(routeId) ?? new Map<number, Set<string>>();
		const excludeAnyOf = (routeId: string, clauseIndex: number, excludedFactId: string) => {
			const byClause = readAnyOfExclusions(routeId);
			const excluded = byClause.get(clauseIndex) ?? new Set<string>();
			excluded.add(excludedFactId);
			byClause.set(clauseIndex, excluded);
			excludedAnyOfByRouteId.set(routeId, byClause);
		};
		const addRejectedRoute = (routeId: string, diagnostic: EditorItemEstimateDiagnostic) => {
			if (rejectedRoutes.some((rejected) => rejected.routeId === routeId)) return;
			rejectedRoutes.push({
				diagnostics: [
					diagnostic,
				],
				routeId,
			});
		};
		return {
			addRejectedRoute,
			excludeAnyOf,
			excludedRouteIds,
			readAnyOfExclusions,
			rejectedRoutes,
			rejectFallbackChoice: (failedId, diagnostic, selected) => {
				const pendingParents = [
					failedId,
				];
				const visited = new Set<string>();
				while (pendingParents.length > 0) {
					const dependencyId = pendingParents.shift();
					if (dependencyId === undefined || visited.has(dependencyId)) continue;
					visited.add(dependencyId);
					const parents = [
						...selected,
					]
						.filter(([, plan]) =>
							plan.groups.some((group) => group.factId === dependencyId),
						)
						.sort(([left], [right]) => left.localeCompare(right));
					for (const [parentId, plan] of parents) {
						const exclusionsByClause = readAnyOfExclusions(plan.route.id);
						const group = plan.groups.find(({ factId }) => factId === dependencyId);
						const fallbackClauseIndex = group?.anyOfClauseIndexes.find(
							(clauseIndex) => {
								const excluded = exclusionsByClause.get(clauseIndex) ?? new Set();
								return plan.route.requirements.anyOf[clauseIndex]?.some(
									({ factId }) =>
										factId !== dependencyId &&
										!excluded.has(factId) &&
										policy.unitCost.has(factId),
								);
							},
						);
						if (fallbackClauseIndex !== undefined) {
							excludeAnyOf(plan.route.id, fallbackClauseIndex, dependencyId);
							addRejectedRoute(
								("routeId" in diagnostic ? diagnostic.routeId : undefined) ??
									plan.route.id,
								diagnostic,
							);
							return true;
						}
						const hasRouteFallback =
							parentId !== factId &&
							(policy.routesByFact.get(parentId) ?? []).some(
								(route) =>
									route.id !== plan.route.id && !excludedRouteIds.has(route.id),
							);
						if (hasRouteFallback) {
							excludedRouteIds.add(plan.route.id);
							addRejectedRoute(plan.route.id, diagnostic);
							return true;
						}
						pendingParents.push(parentId);
					}
				}
				return false;
			},
		};
	}),
);
