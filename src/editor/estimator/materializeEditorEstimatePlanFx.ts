import { Effect } from "effect";

import type { EditorEstimateRoute } from "~/editor/estimator/EditorEstimateDependencyGraph";
import type { EditorEstimateDemandClosureState } from "~/editor/estimator/createEditorEstimateDemandClosureStateFx";
import { createEditorEstimateDemandClosureStateFx } from "~/editor/estimator/createEditorEstimateDemandClosureStateFx";
import type { EditorEstimateFallbackChoices } from "~/editor/estimator/createEditorEstimateFallbackChoicesFx";
import { createEditorEstimateFallbackChoicesFx } from "~/editor/estimator/createEditorEstimateFallbackChoicesFx";
import type { EditorEstimatePolicy } from "~/editor/estimator/createEditorEstimatePolicyFx";
import type {
	EditorItemEstimateDiagnostic,
	EditorItemEstimateRejectedRoute,
	EditorItemEstimateRouteStep,
} from "~/editor/estimator/EditorItemEstimate";
import type { EditorEstimateSelectedRoute } from "~/editor/estimator/projectEditorEstimateRouteStepFx";
import { projectEditorEstimateRouteStepFx } from "~/editor/estimator/projectEditorEstimateRouteStepFx";

export interface EditorEstimateCandidatePlan {
	readonly consumables: Map<string, number>;
	readonly durationMs: number;
	readonly node: EditorItemEstimateRouteStep;
	readonly ongoing: Map<string, number>;
	readonly oneTime: Map<string, number>;
	readonly rejectedRoutes: ReadonlyArray<EditorItemEstimateRejectedRoute>;
}

export interface EditorEstimateCandidateFailure {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
}

const readNextRoute = ({
	factId,
	fallbacks,
	id,
	needed,
	policy,
	state,
	topRoute,
}: {
	readonly factId: string;
	readonly fallbacks: EditorEstimateFallbackChoices;
	readonly id: string;
	readonly needed: number;
	readonly policy: EditorEstimatePolicy;
	readonly state: EditorEstimateDemandClosureState;
	readonly topRoute: EditorEstimateRoute;
}): EditorEstimateCandidateFailure | EditorEstimateSelectedRoute => {
	const candidates =
		id === factId
			? [
					topRoute,
				]
			: [
					...(policy.routesByFact.get(id) ?? []),
				]
					.filter((route) => !fallbacks.excludedRouteIds.has(route.id))
					.sort(
						(left, right) =>
							policy.readRouteCost(left, needed) -
								policy.readRouteCost(right, needed) ||
							left.id.localeCompare(right.id),
					);
	let zeroYieldRouteId: string | undefined;
	let cyclicRouteId: string | undefined;
	let cyclicFactIds: ReadonlyArray<string> | undefined;
	for (const route of candidates) {
		routeAttempt: for (;;) {
			const outputRuns = policy.readExpectedRuns(route.output.quantityDistribution, needed);
			if (!Number.isFinite(outputRuns)) {
				zeroYieldRouteId = route.id;
				fallbacks.addRejectedRoute(route.id, {
					factId: id,
					kind: "zero-yield",
					routeId: route.id,
				});
				break routeAttempt;
			}
			const actionRuns = outputRuns * route.runMultiplier;
			const exclusionsByClause = fallbacks.readAnyOfExclusions(route.id);
			const groups = policy.chooseRequirements(route, actionRuns, exclusionsByClause);
			if (groups === undefined || groups.some((group) => !policy.unitCost.has(group.factId)))
				break routeAttempt;
			const recurrenceFactIds = new Set(
				groups
					.filter((group) => {
						const root = policy.roots.get(group.factId);
						return (
							group.consumed <= 1e-9 &&
							(root === "unbounded" ||
								(root ?? 0) >= Math.max(group.oneTime, group.ongoing))
						);
					})
					.map((group) => group.factId)
					.filter(
						(dependencyId) =>
							state.readCyclePath(id, dependencyId) !== undefined &&
							policy.seededComponentByFact.get(id) !== undefined &&
							policy.seededComponentByFact.get(id) ===
								policy.seededComponentByFact.get(dependencyId),
					),
			);
			const cyclicGroup = groups.find(
				(group) =>
					!recurrenceFactIds.has(group.factId) &&
					state.readCyclePath(id, group.factId) !== undefined,
			);
			if (cyclicGroup === undefined)
				return {
					actionRuns,
					groups,
					outputRuns,
					producedQuantity: needed,
					recurrenceFactIds,
					route,
				};
			const fallbackClauseIndex = cyclicGroup.anyOfClauseIndexes.find((clauseIndex) => {
				const excluded = exclusionsByClause.get(clauseIndex) ?? new Set();
				return route.requirements.anyOf[clauseIndex]?.some(
					({ factId }) =>
						factId !== cyclicGroup.factId &&
						!excluded.has(factId) &&
						policy.unitCost.has(factId),
				);
			});
			if (fallbackClauseIndex !== undefined) {
				fallbacks.excludeAnyOf(route.id, fallbackClauseIndex, cyclicGroup.factId);
				continue routeAttempt;
			}
			cyclicRouteId = route.id;
			cyclicFactIds = state.readCyclePath(id, cyclicGroup.factId);
			fallbacks.addRejectedRoute(route.id, {
				factIds: cyclicFactIds ?? [
					id,
				],
				kind: "cycle",
				routeId: route.id,
			});
			break routeAttempt;
		}
	}
	const diagnostic: EditorItemEstimateDiagnostic =
		cyclicRouteId !== undefined
			? {
					factIds: cyclicFactIds ?? [
						id,
					],
					kind: "cycle",
					routeId: cyclicRouteId,
				}
			: zeroYieldRouteId !== undefined
				? {
						factId: id,
						kind: "zero-yield",
						routeId: zeroYieldRouteId,
					}
				: {
						factId: id,
						kind: "unreachable",
						quantity: needed,
					};
	return {
		diagnostics: [
			diagnostic,
		],
	};
};

/** Materializes one candidate route through the deterministic nested policy and shared demands. */
export const materializeEditorEstimatePlanFx = Effect.fn("materializeEditorEstimatePlanFx")(
	({
		factId,
		policy,
		quantity,
		topRoute,
	}: {
		readonly factId: string;
		readonly policy: EditorEstimatePolicy;
		readonly quantity: number;
		readonly topRoute: EditorEstimateRoute;
	}) =>
		Effect.gen(function* () {
			const fallbacks = yield* createEditorEstimateFallbackChoicesFx({
				factId,
				policy,
			});
			let state: EditorEstimateDemandClosureState;
			restart: for (;;) {
				state = yield* createEditorEstimateDemandClosureStateFx({
					factId,
					policy,
					quantity,
				});
				for (let pendingIndex = 0; pendingIndex < state.pending.length; pendingIndex += 1) {
					const id = state.dequeue(pendingIndex);
					if (id === undefined) continue;
					const needed = state.missingQuantity(id);
					if (needed <= (state.selected.get(id)?.producedQuantity ?? 0) + 1e-9) continue;
					const next = readNextRoute({
						factId,
						fallbacks,
						id,
						needed,
						policy,
						state,
						topRoute,
					});
					if ("diagnostics" in next) {
						const diagnostic = next.diagnostics[0];
						if (
							diagnostic !== undefined &&
							fallbacks.rejectFallbackChoice(id, diagnostic, state.selected)
						)
							continue restart;
						return next;
					}
					state.select(id, next);
				}
				break;
			}
			const node = yield* projectEditorEstimateRouteStepFx({
				dependencies: state.dependencies,
				factId,
				requiredQuantityByFact: state.readRequiredQuantities(),
				selected: state.selected,
				topRouteId: topRoute.id,
			});
			if ("diagnostics" in node) return node;
			const durationMs = [
				...state.selected.values(),
			].reduce((total, plan) => total + plan.route.durationMs * plan.actionRuns, 0);
			return {
				consumables: state.consumables,
				durationMs,
				node,
				ongoing: state.ongoing,
				oneTime: state.oneTime,
				rejectedRoutes: fallbacks.rejectedRoutes,
			};
		}),
);
