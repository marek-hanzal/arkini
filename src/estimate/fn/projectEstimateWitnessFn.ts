import { Order } from "effect";

import type {
	EstimateAmount,
	EstimateProjection,
	EstimateRequirementStep,
	EstimateRouteStep,
} from "~/estimate/type/EstimateProjection";
import type { EstimateWitness } from "~/estimate/type/EstimateWitness";

const epsilon = 1e-9;

const freezeAmountsFn = (quantities: ReadonlyMap<string, number>): ReadonlyArray<EstimateAmount> =>
	[
		...quantities,
	]
		.filter(([, quantity]) => quantity > epsilon)
		.sort(([left], [right]) => Order.String(left, right))
		.map(([factId, quantity]) => ({
			factId,
			quantity,
		}));

const projectRouteStepsFn = (witness: EstimateWitness): ReadonlyArray<EstimateRouteStep> => {
	const stepsByFact = new Map<string, EstimateRouteStep>();
	const unresolved = new Set(witness.selectedByFact.keys());
	while (unresolved.size > 0) {
		let progressed = false;
		for (const factId of [
			...unresolved,
		].sort(Order.String)) {
			const selected = witness.selectedByFact.get(factId);
			if (
				selected === undefined ||
				[
					...(witness.dependenciesByFact.get(factId) ?? []),
				].some(
					(dependencyFactId) =>
						witness.selectedByFact.has(dependencyFactId) &&
						!stepsByFact.has(dependencyFactId),
				)
			)
				continue;
			const requirements: EstimateRequirementStep[] = [];
			for (const group of selected.groups) {
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
					if (quantity <= epsilon) continue;
					requirements.push({
						acquisitionFactId:
							first && !selected.recurrenceFactIds.has(group.factId)
								? stepsByFact.get(group.factId)?.factId
								: undefined,
						factId: group.factId,
						quantity,
						sources: group.sources,
						usage,
					});
					first = false;
				}
			}
			stepsByFact.set(factId, {
				actionRuns: selected.actionRuns,
				durationMs: selected.route.durationMs * selected.actionRuns,
				factId,
				metadata: selected.route.metadata,
				outputRuns: selected.outputRuns,
				quantity: witness.requiredQuantityByFact.get(factId) ?? 0,
				requirements,
				rootQuantity:
					(witness.requiredQuantityByFact.get(factId) ?? 0) - selected.producedQuantity,
				routeId: selected.route.id,
				source: "route",
			});
			unresolved.delete(factId);
			progressed = true;
		}
		// Materialization rejects dependency cycles. This fallback keeps projection total for a
		// malformed external witness without fabricating partially ordered route steps.
		if (!progressed) return [];
	}

	const route = stepsByFact.get(witness.factId);
	if (route === undefined) {
		const root: EstimateRouteStep = {
			actionRuns: 0,
			durationMs: 0,
			factId: witness.factId,
			outputRuns: 0,
			quantity: witness.quantity,
			requirements: [],
			rootQuantity: witness.quantity,
			routeId: `root:${witness.factId}`,
			source: "root",
		};
		return [
			root,
		];
	}
	return [
		route,
		...[
			...stepsByFact.values(),
		]
			.filter((step) => step.factId !== witness.factId)
			.sort((left, right) => Order.String(left.factId, right.factId)),
	];
};

const readParallelDurationFn = (witness: EstimateWitness): number => {
	const unitByFactId = new Map<string, string>();
	const durationByUnitId = new Map<string, number>();
	for (const [factId, selected] of witness.selectedByFact) {
		const operationId = selected.route.operation?.id;
		const unitId =
			operationId !== undefined && witness.sharedOperationIds.has(operationId)
				? `operation:${operationId}`
				: `fact:${factId}`;
		unitByFactId.set(factId, unitId);
		durationByUnitId.set(
			unitId,
			Math.max(
				durationByUnitId.get(unitId) ?? 0,
				selected.route.durationMs * selected.actionRuns,
			),
		);
	}

	const dependenciesByUnitId = new Map<string, Set<string>>();
	for (const [factId, dependencyFactIds] of witness.dependenciesByFact) {
		const unitId = unitByFactId.get(factId);
		if (unitId === undefined) continue;
		const dependencies = dependenciesByUnitId.get(unitId) ?? new Set<string>();
		for (const dependencyFactId of dependencyFactIds) {
			const dependencyUnitId = unitByFactId.get(dependencyFactId);
			if (dependencyUnitId !== undefined && dependencyUnitId !== unitId)
				dependencies.add(dependencyUnitId);
		}
		dependenciesByUnitId.set(unitId, dependencies);
	}

	const readyAtByUnitId = new Map<string, number>();
	const pending = new Set(durationByUnitId.keys());
	while (pending.size > 0) {
		let progressed = false;
		for (const unitId of [
			...pending,
		].sort(Order.String)) {
			const dependencies = dependenciesByUnitId.get(unitId) ?? new Set();
			if (
				[
					...dependencies,
				].some((dependencyUnitId) => !readyAtByUnitId.has(dependencyUnitId))
			)
				continue;
			readyAtByUnitId.set(
				unitId,
				(durationByUnitId.get(unitId) ?? 0) +
					Math.max(
						0,
						...[
							...dependencies,
						].map((dependencyUnitId) => readyAtByUnitId.get(dependencyUnitId) ?? 0),
					),
			);
			pending.delete(unitId);
			progressed = true;
		}
		if (!progressed) return Number.POSITIVE_INFINITY;
	}
	return readyAtByUnitId.get(unitByFactId.get(witness.factId) ?? "") ?? 0;
};

/** Projects one selected-by-fact witness into its normalized route DAG and critical path. */
export const projectEstimateWitnessFn = (witness: EstimateWitness): EstimateProjection => {
	const routeSteps = projectRouteStepsFn(witness);
	const route = routeSteps[0] ?? {
		actionRuns: 0,
		durationMs: 0,
		factId: witness.factId,
		outputRuns: 0,
		quantity: witness.quantity,
		requirements: [],
		rootQuantity: witness.quantity,
		routeId: `root:${witness.factId}`,
		source: "root" as const,
	};
	return {
		durationMs: readParallelDurationFn(witness),
		requirementSummary: {
			consumed: freezeAmountsFn(witness.consumedByFact),
			oneTime: freezeAmountsFn(witness.oneTimeByFact),
			ongoing: freezeAmountsFn(witness.ongoingByFact),
		},
		route,
		routeSteps,
	};
};
