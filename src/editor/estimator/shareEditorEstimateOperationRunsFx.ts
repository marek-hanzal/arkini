import { Effect } from "effect";

import type { EditorEstimatePolicy } from "~/editor/estimator/createEditorEstimatePolicyFx";
import type { EditorItemEstimateDiagnostic } from "~/editor/estimator/EditorItemEstimate";
import type { EditorEstimateSelectedRoute } from "~/editor/estimator/projectEditorEstimateRouteStepFx";

interface SharedOperationSelection {
	readonly selected: Map<string, EditorEstimateSelectedRoute>;
	readonly sharedOperationIds: ReadonlySet<string>;
	readonly status: "complete";
}

interface SharedOperationFailure {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly status: "failure";
}

/** Credits jointly selected co-products while charging their authored operation only once. */
export const shareEditorEstimateOperationRunsFx = Effect.fn("shareEditorEstimateOperationRunsFx")(
	({
		factId,
		policy,
		selected,
		topRouteId,
	}: {
		readonly factId: string;
		readonly policy: EditorEstimatePolicy;
		readonly selected: ReadonlyMap<string, EditorEstimateSelectedRoute>;
		readonly topRouteId: string;
	}) =>
		Effect.sync(() => {
			const result = new Map(selected);
			const selectedByOperationId = new Map<
				string,
				Array<
					[
						string,
						EditorEstimateSelectedRoute,
					]
				>
			>();
			for (const entry of selected) {
				const operationId = entry[1].route.operation?.id;
				if (operationId === undefined) continue;
				const entries = selectedByOperationId.get(operationId) ?? [];
				entries.push(entry);
				selectedByOperationId.set(operationId, entries);
			}
			const sharedOperationIds = new Set<string>();
			for (const entries of selectedByOperationId.values()) {
				if (entries.length < 2) continue;
				const operation = entries[0]?.[1].route.operation;
				if (operation?.outputDistribution === undefined) continue;
				const demandByOutputGroupId = new Map<string, number>();
				for (const [, plan] of entries) {
					const outputGroupId = plan.route.output.operationOutputGroupId;
					if (outputGroupId !== undefined)
						demandByOutputGroupId.set(outputGroupId, plan.producedQuantity);
				}
				if (demandByOutputGroupId.size < 2) continue;
				const expected = policy.expectedRuns.read({
					demandByOutputGroupId,
					distribution: operation.outputDistribution,
				});
				if (expected.status === "state-space-unsupported")
					return {
						diagnostics: [
							{
								kind: "joint-output-accounting-unsupported",
								reason: "state-space",
								routeId: entries[0]?.[1].route.id ?? topRouteId,
							},
						],
						status: "failure",
					} satisfies SharedOperationFailure;
				if (!Number.isFinite(expected.runs))
					return {
						diagnostics: [
							{
								factId: entries[0]?.[0] ?? factId,
								kind: "zero-yield",
								routeId: entries[0]?.[1].route.id ?? topRouteId,
							},
						],
						status: "failure",
					} satisfies SharedOperationFailure;
				const actionRuns =
					expected.runs *
					Math.max(...entries.map(([, plan]) => plan.route.runMultiplier));
				sharedOperationIds.add(operation.id);
				const groupsByFactId = new Map<
					string,
					EditorEstimateSelectedRoute["groups"][number]
				>();
				for (const [, plan] of entries) {
					const groups = policy.chooseRequirements(
						plan.route,
						actionRuns,
						plan.producedQuantity,
					);
					if (groups === undefined) continue;
					for (const group of groups) {
						const current = groupsByFactId.get(group.factId);
						groupsByFactId.set(group.factId, {
							...group,
							anyOfClauseIndexes: [
								...new Set([
									...(current?.anyOfClauseIndexes ?? []),
									...group.anyOfClauseIndexes,
								]),
							],
							charged: (current?.charged ?? false) || group.charged,
							consumed: Math.max(current?.consumed ?? 0, group.consumed),
							distinctOneTime: Math.max(
								current?.distinctOneTime ?? 0,
								group.distinctOneTime,
							),
							oneTime: Math.max(current?.oneTime ?? 0, group.oneTime),
							ongoing: Math.max(current?.ongoing ?? 0, group.ongoing),
							sources: [
								...new Set([
									...(current?.sources ?? []),
									...group.sources,
								]),
							].sort(),
						});
					}
				}
				const groups = [
					...groupsByFactId.values(),
				].sort((left, right) => left.factId.localeCompare(right.factId));
				for (const [id, plan] of entries)
					result.set(id, {
						...plan,
						actionRuns,
						groups,
						outputRuns: expected.runs,
					});
			}
			return {
				selected: result,
				sharedOperationIds,
				status: "complete",
			} satisfies SharedOperationSelection;
		}),
);
