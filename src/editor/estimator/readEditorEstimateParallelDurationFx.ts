import { Effect } from "effect";

import type { EditorEstimateSelectedRoute } from "~/editor/estimator/projectEditorEstimateRouteStepFx";

/** Reads the optimistic critical-path duration after shared operations are normalized. */
export const readEditorEstimateParallelDurationFx = Effect.fn(
	"readEditorEstimateParallelDurationFx",
)(
	({
		dependencies,
		factId,
		selected,
		sharedOperationIds,
	}: {
		readonly dependencies: ReadonlyMap<string, ReadonlySet<string>>;
		readonly factId: string;
		readonly selected: ReadonlyMap<string, EditorEstimateSelectedRoute>;
		readonly sharedOperationIds: ReadonlySet<string>;
	}) =>
		Effect.sync(() => {
			const unitByFactId = new Map<string, string>();
			const durationByUnitId = new Map<string, number>();
			for (const [id, plan] of selected) {
				const operationId = plan.route.operation?.id;
				const unitId =
					operationId !== undefined && sharedOperationIds.has(operationId)
						? `operation:${operationId}`
						: `fact:${id}`;
				unitByFactId.set(id, unitId);
				durationByUnitId.set(
					unitId,
					Math.max(
						durationByUnitId.get(unitId) ?? 0,
						plan.route.durationMs * plan.actionRuns,
					),
				);
			}

			const dependenciesByUnitId = new Map<string, Set<string>>();
			for (const [id, dependencyFactIds] of dependencies) {
				const unitId = unitByFactId.get(id);
				if (unitId === undefined) continue;
				const unitDependencies = dependenciesByUnitId.get(unitId) ?? new Set<string>();
				for (const dependencyFactId of dependencyFactIds) {
					const dependencyUnitId = unitByFactId.get(dependencyFactId);
					if (dependencyUnitId !== undefined && dependencyUnitId !== unitId)
						unitDependencies.add(dependencyUnitId);
				}
				dependenciesByUnitId.set(unitId, unitDependencies);
			}

			const readyAtByUnitId = new Map<string, number>();
			const pending = new Set(durationByUnitId.keys());
			while (pending.size > 0) {
				let progressed = false;
				for (const unitId of [
					...pending,
				].sort()) {
					const unitDependencies = dependenciesByUnitId.get(unitId) ?? new Set();
					if (
						[
							...unitDependencies,
						].some((dependencyUnitId) => !readyAtByUnitId.has(dependencyUnitId))
					)
						continue;
					readyAtByUnitId.set(
						unitId,
						(durationByUnitId.get(unitId) ?? 0) +
							Math.max(
								0,
								...[
									...unitDependencies,
								].map(
									(dependencyUnitId) =>
										readyAtByUnitId.get(dependencyUnitId) ?? 0,
								),
							),
					);
					pending.delete(unitId);
					progressed = true;
				}
				if (!progressed) return Number.POSITIVE_INFINITY;
			}
			return readyAtByUnitId.get(unitByFactId.get(factId) ?? "") ?? 0;
		}),
);
