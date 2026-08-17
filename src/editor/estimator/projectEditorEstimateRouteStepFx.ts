import { Effect } from "effect";

import type { EditorEstimateRoute } from "~/editor/estimator/EditorEstimateDependencyGraph";
import type { EditorEstimateRequirementGroup } from "~/editor/estimator/createEditorEstimatePolicyFx";
import type {
	EditorItemEstimateDiagnostic,
	EditorItemEstimateRequirementStep,
	EditorItemEstimateRouteStep,
} from "~/editor/estimator/EditorItemEstimate";

export interface EditorEstimateSelectedRoute {
	readonly actionRuns: number;
	readonly groups: ReadonlyArray<EditorEstimateRequirementGroup>;
	readonly outputRuns: number;
	readonly producedQuantity: number;
	readonly recurrenceFactIds: ReadonlySet<string>;
	readonly route: EditorEstimateRoute;
}

interface ProjectionFailure {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
}

/** Projects one completed demand closure into the recursive route explanation consumed by UI/MCP. */
export const projectEditorEstimateRouteStepFx = Effect.fn("projectEditorEstimateRouteStepFx")(
	({
		dependencies,
		factId,
		requiredQuantityByFact,
		selected,
		topRouteId,
	}: {
		readonly dependencies: ReadonlyMap<string, ReadonlySet<string>>;
		readonly factId: string;
		readonly requiredQuantityByFact: ReadonlyMap<string, number>;
		readonly selected: ReadonlyMap<string, EditorEstimateSelectedRoute>;
		readonly topRouteId: string;
	}) =>
		Effect.sync((): EditorItemEstimateRouteStep | ProjectionFailure => {
			const unresolved = new Set(selected.keys());
			const nodes = new Map<string, EditorItemEstimateRouteStep>();
			while (unresolved.size > 0) {
				let progressed = false;
				for (const id of [
					...unresolved,
				].sort()) {
					const plan = selected.get(id);
					if (
						plan === undefined ||
						[
							...(dependencies.get(id) ?? []),
						].some(
							(dependencyId) =>
								selected.has(dependencyId) && !nodes.has(dependencyId),
						)
					)
						continue;
					const requirements: EditorItemEstimateRequirementStep[] = [];
					for (const group of plan.groups) {
						let first = true;
						for (const [usage, quantity] of [
							[
								"consume",
								group.consumed,
							],
							[
								"one-time",
								group.oneTime,
							],
							[
								"ongoing",
								group.ongoing,
							],
						] as const) {
							if (quantity <= 0) continue;
							requirements.push({
								acquisition:
									first && !plan.recurrenceFactIds.has(group.factId)
										? nodes.get(group.factId)
										: undefined,
								factId: group.factId,
								quantity,
								usage,
							});
							first = false;
						}
					}
					nodes.set(id, {
						actionRuns: plan.actionRuns,
						durationMs: plan.route.durationMs * plan.actionRuns,
						factId: id,
						metadata: plan.route.metadata,
						outputRuns: plan.outputRuns,
						quantity: requiredQuantityByFact.get(id) ?? 0,
						requirements,
						rootQuantity: (requiredQuantityByFact.get(id) ?? 0) - plan.producedQuantity,
						routeId: plan.route.id,
						source: "route",
					});
					unresolved.delete(id);
					progressed = true;
				}
				if (!progressed)
					return {
						diagnostics: [
							{
								factIds: [
									...unresolved,
								],
								kind: "cycle",
								routeId: topRouteId,
							},
						],
					};
			}
			return (
				nodes.get(factId) ?? {
					diagnostics: [
						{
							factId,
							kind: "unreachable",
							quantity: requiredQuantityByFact.get(factId) ?? 0,
						},
					],
				}
			);
		}),
);
