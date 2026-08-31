import { Order } from "effect";

import {
	type EstimateRouteChoicePoint,
	type EstimateRoutePolicy,
	readEstimateRouteRequirementsFn,
} from "~/estimate/fn/createEstimateRoutePolicyFn";
import { readEstimateExpectedRunsFn } from "~/estimate/fn/readEstimateExpectedRunsFn";
import type { ItemEstimateDiagnostic } from "~/estimate/type/ItemEstimate";
import type { EstimateSelectedRoute } from "~/estimate/type/EstimateWitness";

interface ShareEstimateOperationRunsProps {
	readonly choiceOverrides: ReadonlyMap<string, string>;
	readonly factId: string;
	readonly policy: EstimateRoutePolicy;
	readonly selected: ReadonlyMap<string, EstimateSelectedRoute>;
	readonly topRouteId: string;
}

interface SharedOperationFailure {
	readonly diagnostics: ReadonlyArray<ItemEstimateDiagnostic>;
	readonly status: "failure";
}

interface SharedOperationSuccess {
	readonly choices: ReadonlyArray<EstimateRouteChoicePoint>;
	readonly selected: Map<string, EstimateSelectedRoute>;
	readonly sharedOperationIds: ReadonlySet<string>;
	readonly status: "success";
}

/** Accounts one jointly selected authored operation once across all correlated outputs. */
export const shareEstimateOperationRunsFn = ({
	choiceOverrides,
	factId,
	policy,
	selected,
	topRouteId,
}: ShareEstimateOperationRunsProps): SharedOperationFailure | SharedOperationSuccess => {
	const choices = new Map<string, EstimateRouteChoicePoint>();
	const result = new Map(selected);
	const selectedByOperationId = new Map<
		string,
		Array<
			readonly [
				string,
				EstimateSelectedRoute,
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
		const expected = readEstimateExpectedRunsFn({
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
			};
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
			};
		const actionRuns =
			expected.runs * Math.max(...entries.map(([, plan]) => plan.route.runMultiplier));
		sharedOperationIds.add(operation.id);
		const groupsByFactId = new Map<string, EstimateSelectedRoute["groups"][number]>();
		for (const [, plan] of entries) {
			const requirementSelection = readEstimateRouteRequirementsFn(
				policy,
				plan.route,
				actionRuns,
				choiceOverrides,
			);
			if (requirementSelection === undefined) continue;
			for (const choice of requirementSelection.choices) choices.set(choice.key, choice);
			for (const group of requirementSelection.groups) {
				const current = groupsByFactId.get(group.factId);
				groupsByFactId.set(group.factId, {
					...group,
					consumed: Math.max(current?.consumed ?? 0, group.consumed),
					distinctOneTime: Math.max(current?.distinctOneTime ?? 0, group.distinctOneTime),
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
		].sort((left, right) => Order.String(left.factId, right.factId));
		for (const [id, plan] of entries)
			result.set(id, {
				...plan,
				actionRuns,
				groups,
				outputRuns: expected.runs,
			});
	}
	return {
		choices: [
			...choices.values(),
		],
		selected: result,
		sharedOperationIds,
		status: "success",
	};
};
