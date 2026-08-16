import { Effect } from "effect";

import type { PlannerBudgetExceeded } from "~/editor/planner/PlannerBudget";
import type { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import {
	DefaultPlannerProducerExpansionBudget,
	type PlannerProducerExpansionBudget,
	type PlannerProducerExpansionDiagnostics,
	type PlannerProducerExpansionResult,
} from "~/editor/planner/PlannerProducerExpansion";
import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerRequirementDemand } from "~/editor/planner/PlannerRequirementDemand";
import { addPlannerRequirementDemandFx } from "~/editor/planner/addPlannerRequirementDemandFx";
import { readPlannerRequirementSourcePriorityFx } from "~/editor/planner/readPlannerRequirementSourcePriorityFx";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerSearchAction } from "~/editor/planner/PlannerSearchScope";
import { isPlannerRuntimeQuiescentFx } from "~/editor/planner/isPlannerRuntimeQuiescentFx";
import { readPlannerGoalAgendaViabilityFx } from "~/editor/planner/readPlannerGoalAgendaViabilityFx";
import { readPlannerItemGoalStatusFx } from "~/editor/planner/readPlannerItemGoalStatusFx";
import { readPlannerRuntimeFingerprintFx } from "~/editor/planner/readPlannerRuntimeFingerprintFx";
import { readPlannerSearchActionsFx } from "~/editor/planner/readPlannerSearchActionsFx";
import { readPlannerStructuralReachabilityFx } from "~/editor/planner/readPlannerStructuralReachabilityFx";
import { runPlannerSearchCandidateFx } from "~/editor/planner/runPlannerSearchCandidateFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace expandPlannerProducerWorldFx {
	export interface Props {
		readonly budget?: Partial<PlannerProducerExpansionBudget>;
		readonly graph: PlannerAcquisitionGraph;
		readonly goal: PlannerItemGoal;
		readonly runtime: RuntimeSchema.Type;
	}
}

interface PlannerProducerDemand {
	minimumCharges: number;
	priority: number;
	quantity: number;
}

interface PlannerProducerExpansionCandidate {
	readonly action: PlannerSearchAction;
	readonly available: boolean;
	readonly demandPriority: number;
	readonly preferredDemandWitness: boolean;
	readonly purpose: "capability" | "demand" | "novelty";
	readonly relevantOutputItemIds: ReadonlyArray<IdSchema.Type>;
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readInitialExecution = (runtime: RuntimeSchema.Type): PlannerSearchExecutionState => ({
	elapsedMs: 0,
	outputCertainty: "deterministic",
	runtime,
	selectedWitnessProbability: 1,
	trace: [],
});

const readRequirementGoal = (requirement: PlannerAcquisitionRequirement): PlannerItemGoal => ({
	itemId: requirement.itemId,
	minimumCharges: requirement.usage === "charge" ? (requirement.chargeCost ?? 0) : 0,
	quantity: requirement.minimumQuantity,
});

const readRuntimeQuantity = (runtime: RuntimeSchema.Type, itemId: IdSchema.Type) =>
	runtime.items.reduce((total, item) => total + (item.item.id === itemId ? item.quantity : 0), 0);

const readRuntimeChargeCapacity = (runtime: RuntimeSchema.Type, itemId: IdSchema.Type) =>
	runtime.items.reduce((total, item) => {
		if (item.item.id !== itemId) return total;
		const fullCapacity = item.item.charges?.amount;
		if (fullCapacity === undefined) return total;
		return total + (item.remainingCharges ?? fullCapacity) * item.quantity;
	}, 0);

const isGoalSatisfied = (goal: PlannerItemGoal, runtime: RuntimeSchema.Type) => {
	const minimumCharges = goal.minimumCharges ?? 0;
	return (
		readRuntimeQuantity(runtime, goal.itemId) >= goal.quantity &&
		readRuntimeChargeCapacity(runtime, goal.itemId) >= minimumCharges
	);
};

const readRouteRequirementGoalsFx = Effect.fn("expandPlannerProducerWorldFx.routeRequirementGoals")(
	function* ({
		graph,
		route,
		runtime,
	}: {
		readonly graph: PlannerAcquisitionGraph;
		readonly route: PlannerAcquisitionRoute;
		readonly runtime: RuntimeSchema.Type;
	}) {
		const demandByItemId = new Map<IdSchema.Type, PlannerRequirementDemand>();
		for (const requirement of route.requirements.allOf)
			yield* addPlannerRequirementDemandFx(demandByItemId, requirement);
		for (const clause of route.requirements.anyOf) {
			if (
				clause.some((requirement) =>
					isGoalSatisfied(readRequirementGoal(requirement), runtime),
				)
			)
				continue;
			const prioritized = yield* Effect.forEach(clause, (requirement) =>
				readPlannerRequirementSourcePriorityFx(requirement.source).pipe(
					Effect.map((sourcePriority) => ({
						requirement,
						sourcePriority,
					})),
				),
			);
			const selected = prioritized.sort(
				(left, right) =>
					left.sourcePriority - right.sourcePriority ||
					(graph.depthByItemId.get(left.requirement.itemId) ?? Number.POSITIVE_INFINITY) -
						(graph.depthByItemId.get(right.requirement.itemId) ??
							Number.POSITIVE_INFINITY) ||
					compareIds(left.requirement.itemId, right.requirement.itemId),
			)[0]?.requirement;
			if (selected !== undefined)
				yield* addPlannerRequirementDemandFx(demandByItemId, selected);
		}
		return [
			...demandByItemId,
		]
			.map(([itemId, demand]) => ({
				goal: {
					itemId,
					minimumCharges: demand.charges,
					quantity: demand.consumed + demand.retained,
				} satisfies PlannerItemGoal,
				sourcePriority: demand.sourcePriority,
			}))
			.filter(({ goal }) => !isGoalSatisfied(goal, runtime))
			.sort(
				(left, right) =>
					left.sourcePriority - right.sourcePriority ||
					(graph.depthByItemId.get(right.goal.itemId) ?? 0) -
						(graph.depthByItemId.get(left.goal.itemId) ?? 0) ||
					compareIds(left.goal.itemId, right.goal.itemId),
			);
	},
);

const readCandidateAvailable = (candidate: PlannerSearchAction, runtime: RuntimeSchema.Type) => {
	switch (candidate.action.kind) {
		case "line":
			return readRuntimeQuantity(runtime, candidate.action.ownerItemId) > 0;
		case "merge": {
			const sourceQuantity = readRuntimeQuantity(runtime, candidate.action.sourceItemId);
			const targetQuantity = readRuntimeQuantity(runtime, candidate.action.targetItemId);
			return candidate.action.sourceItemId === candidate.action.targetItemId
				? sourceQuantity >= 2
				: sourceQuantity > 0 && targetQuantity > 0;
		}
		case "temporary-expiry":
			return readRuntimeQuantity(runtime, candidate.action.itemId) > 0;
	}
};

const readRuntimeItemIds = (runtime: RuntimeSchema.Type) =>
	new Set<IdSchema.Type>(
		runtime.items.flatMap(({ item, quantity }) =>
			quantity > 0
				? [
						item.id,
					]
				: [],
		),
	);

const readRuntimeQuantityByItemId = (runtime: RuntimeSchema.Type) => {
	const quantityByItemId = new Map<IdSchema.Type, number>();
	for (const item of runtime.items)
		quantityByItemId.set(
			item.item.id,
			(quantityByItemId.get(item.item.id) ?? 0) + item.quantity,
		);
	return quantityByItemId;
};

const readActionOwnerOutputs = (actions: ReadonlyArray<PlannerSearchAction>) => {
	const outputItemIdsByOwnerItemId = new Map<IdSchema.Type, Set<IdSchema.Type>>();
	for (const candidate of actions) {
		if (candidate.action.kind !== "line" || candidate.outputMode !== "canonical") continue;
		const outputItemIds =
			outputItemIdsByOwnerItemId.get(candidate.action.ownerItemId) ??
			new Set<IdSchema.Type>();
		for (const itemId of candidate.outputItemIds) outputItemIds.add(itemId);
		outputItemIdsByOwnerItemId.set(candidate.action.ownerItemId, outputItemIds);
	}
	return outputItemIdsByOwnerItemId;
};

const compareCandidates = (
	left: PlannerProducerExpansionCandidate,
	right: PlannerProducerExpansionCandidate,
) => {
	const purposeRank = {
		demand: 0,
		capability: 1,
		novelty: 2,
	} as const;
	return (
		purposeRank[left.purpose] - purposeRank[right.purpose] ||
		right.demandPriority - left.demandPriority ||
		Number(right.preferredDemandWitness) - Number(left.preferredDemandWitness) ||
		Number(right.action.outputMode === "canonical") -
			Number(left.action.outputMode === "canonical") ||
		Number(right.available) - Number(left.available) ||
		left.action.depth - right.action.depth ||
		compareIds(left.action.id, right.action.id)
	);
};

const readCandidateRoutes = ({
	candidate,
	relevantOutputItemIds,
	routeById,
}: {
	readonly candidate: PlannerSearchAction;
	readonly relevantOutputItemIds: ReadonlyArray<IdSchema.Type>;
	readonly routeById: ReadonlyMap<string, PlannerAcquisitionRoute>;
}) => {
	const relevant = new Set(relevantOutputItemIds);
	const routes = candidate.routeIds.flatMap((routeId) => {
		const route = routeById.get(routeId);
		return route === undefined || (relevant.size > 0 && !relevant.has(route.output.itemId))
			? []
			: [
					route,
				];
	});
	return routes.length > 0
		? routes
		: candidate.routeIds.flatMap((routeId) => {
				const route = routeById.get(routeId);
				return route === undefined
					? []
					: [
							route,
						];
			});
};

const readDiagnostics = ({
	advancedActions,
	attemptedActions,
	availabilityByItemId,
	blockedActionIds,
	deferredDestructiveActionIds,
	demandByItemId,
	discoveredItemIds,
	maximumCandidateCount,
	unsupportedActionIds,
}: {
	readonly advancedActions: number;
	readonly attemptedActions: number;
	readonly availabilityByItemId: ReadonlyMap<IdSchema.Type, number>;
	readonly blockedActionIds: ReadonlySet<string>;
	readonly deferredDestructiveActionIds: ReadonlySet<string>;
	readonly demandByItemId: ReadonlyMap<IdSchema.Type, PlannerProducerDemand>;
	readonly discoveredItemIds: ReadonlySet<IdSchema.Type>;
	readonly maximumCandidateCount: number;
	readonly unsupportedActionIds: ReadonlySet<string>;
}): PlannerProducerExpansionDiagnostics => ({
	advancedActions,
	attemptedActions,
	availability: [
		...availabilityByItemId,
	]
		.map(([itemId, readyAtMs]) => ({
			itemId,
			readyAtMs,
		}))
		.sort((left, right) => compareIds(left.itemId, right.itemId)),
	blockedActionIds: [
		...blockedActionIds,
	].sort(compareIds),
	deferredDestructiveActionIds: [
		...deferredDestructiveActionIds,
	].sort(compareIds),
	demandedItemIds: [
		...demandByItemId.keys(),
	].sort(compareIds),
	discoveredItemIds: [
		...discoveredItemIds,
	].sort(compareIds),
	maximumCandidateCount,
	unsupportedActionIds: [
		...unsupportedActionIds,
	].sort(compareIds),
});

/**
 * Expands one immutable world through available producer capabilities.
 *
 * The strategy follows concrete unmet demand first, discovers new producer-owned capabilities
 * second, and only then runs remaining canonical novelty actions. A successful preview that would
 * remove the last live copy of a producer is deferred until its unseen canonical outputs were
 * acquired. Every committed step still passes through the canonical planner engine boundary.
 */
export const expandPlannerProducerWorldFx = Effect.fn("expandPlannerProducerWorldFx")(function* ({
	budget: budgetInput,
	goal,
	graph,
	runtime,
}: expandPlannerProducerWorldFx.Props): Effect.fn.Return<
	PlannerProducerExpansionResult,
	PlannerBudgetExceeded,
	GameConfigFx | PlannerBudgetFx
> {
	const budget = {
		...DefaultPlannerProducerExpansionBudget,
		...budgetInput,
	};
	if (!Number.isSafeInteger(budget.maximumExpandedActions) || budget.maximumExpandedActions < 1)
		throw new RangeError(
			"Producer expansion maximumExpandedActions must be a positive safe integer.",
		);
	if (!Number.isSafeInteger(budget.maximumTraceLength) || budget.maximumTraceLength < 0)
		throw new RangeError(
			"Producer expansion maximumTraceLength must be a non-negative safe integer.",
		);

	const structuralReachability = yield* readPlannerStructuralReachabilityFx({
		graph,
		itemId: goal.itemId,
	});
	if (structuralReachability.type !== "reachable")
		return {
			diagnostics: {
				advancedActions: 0,
				attemptedActions: 0,
				availability: [],
				blockedActionIds: [],
				deferredDestructiveActionIds: [],
				demandedItemIds: [
					goal.itemId,
				],
				discoveredItemIds: [
					...readRuntimeItemIds(runtime),
				].sort(compareIds),
				maximumCandidateCount: 0,
				unsupportedActionIds: [],
			},
			proof: structuralReachability,
			type: "no-finite-path",
		};

	let execution = readInitialExecution(runtime);
	const actions = yield* readPlannerSearchActionsFx({
		graph,
		routes: graph.routes,
	});
	const routeById = new Map(
		graph.routes.map((route) => [
			route.id,
			route,
		]),
	);
	const canonicalActionIdsByOutputItemId = new Map<IdSchema.Type, Set<string>>();
	const canonicalQuantityByActionId = new Map<string, ReadonlyMap<IdSchema.Type, number>>();
	for (const action of actions) {
		if (action.outputMode !== "canonical") continue;
		const quantityByItemId = new Map<IdSchema.Type, number>();
		for (const routeId of action.routeIds) {
			const route = routeById.get(routeId);
			if (route === undefined || route.output.stochastic) continue;
			quantityByItemId.set(
				route.output.itemId,
				(quantityByItemId.get(route.output.itemId) ?? 0) + route.output.maximumQuantity,
			);
		}
		canonicalQuantityByActionId.set(action.actionId, quantityByItemId);
		for (const itemId of quantityByItemId.keys()) {
			const actionIds = canonicalActionIdsByOutputItemId.get(itemId) ?? new Set<string>();
			actionIds.add(action.actionId);
			canonicalActionIdsByOutputItemId.set(itemId, actionIds);
		}
	}
	const ownerOutputItemIdsByItemId = readActionOwnerOutputs(actions);
	const capabilityItemIds = new Set(ownerOutputItemIdsByItemId.keys());
	const discoveredItemIds = readRuntimeItemIds(runtime);
	const availabilityByItemId = new Map<IdSchema.Type, number>(
		[
			...discoveredItemIds,
		].map((itemId) => [
			itemId,
			0,
		]),
	);
	const demandByItemId = new Map<IdSchema.Type, PlannerProducerDemand>();
	let nextDemandPriority = 0;
	const addDemand = (itemGoal: PlannerItemGoal) => {
		const current = demandByItemId.get(itemGoal.itemId);
		demandByItemId.set(itemGoal.itemId, {
			minimumCharges: Math.max(current?.minimumCharges ?? 0, itemGoal.minimumCharges ?? 0),
			priority: Math.max(current?.priority ?? -1, nextDemandPriority),
			quantity: Math.max(current?.quantity ?? 0, itemGoal.quantity),
		});
		nextDemandPriority += 1;
	};
	addDemand(goal);

	const blockedFingerprintByCandidateId = new Map<string, string>();
	const completedNoveltyCandidateIds = new Set<string>();
	const blockedActionIds = new Set<string>();
	const unsupportedActionIds = new Set<string>();
	const deferredDestructiveActionIds = new Set<string>();
	let attemptedActions = 0;
	let advancedActions = 0;
	let visitedWorlds = 1;
	let maximumCandidateCount = 0;

	const readCurrentDiagnostics = () =>
		readDiagnostics({
			advancedActions,
			attemptedActions,
			availabilityByItemId,
			blockedActionIds,
			deferredDestructiveActionIds,
			demandByItemId,
			discoveredItemIds,
			maximumCandidateCount,
			unsupportedActionIds,
		});

	while (true) {
		const targetStatus = yield* readPlannerItemGoalStatusFx(goal, execution.runtime);
		if (targetStatus.satisfied)
			return {
				availableQuantity: targetStatus.availableQuantity,
				diagnostics: readCurrentDiagnostics(),
				execution,
				expandedActions: attemptedActions,
				type: "completed",
				visitedWorlds,
			};

		for (const [itemId, demand] of demandByItemId)
			if (
				itemId !== goal.itemId &&
				isGoalSatisfied(
					{
						itemId,
						minimumCharges: demand.minimumCharges,
						quantity: Math.max(1, demand.quantity),
					},
					execution.runtime,
				)
			)
				demandByItemId.delete(itemId);

		if (attemptedActions >= budget.maximumExpandedActions)
			return {
				bestAvailableQuantity: targetStatus.availableQuantity,
				bestExecution: execution,
				blockedActionIds: [
					...blockedActionIds,
				].sort(compareIds),
				budgetLimit: "maximumExpandedActions",
				diagnostics: readCurrentDiagnostics(),
				expandedActions: attemptedActions,
				reason: "search-budget",
				type: "inconclusive",
				unsupportedActionIds: [
					...unsupportedActionIds,
				].sort(compareIds),
				visitedWorlds,
			};
		if (execution.trace.length >= budget.maximumTraceLength)
			return {
				bestAvailableQuantity: targetStatus.availableQuantity,
				bestExecution: execution,
				blockedActionIds: [
					...blockedActionIds,
				].sort(compareIds),
				budgetLimit: "maximumTraceLength",
				diagnostics: readCurrentDiagnostics(),
				expandedActions: attemptedActions,
				reason: "search-budget",
				type: "inconclusive",
				unsupportedActionIds: [
					...unsupportedActionIds,
				].sort(compareIds),
				visitedWorlds,
			};

		const runtimeFingerprint = yield* readPlannerRuntimeFingerprintFx(execution.runtime);
		const candidates: PlannerProducerExpansionCandidate[] = [];
		for (const action of actions) {
			if (blockedFingerprintByCandidateId.get(action.id) === runtimeFingerprint) continue;
			const demandedOutputs = action.outputItemIds.flatMap((itemId) => {
				// Treat a stochastic output from another action as incidental while a direct
				// deterministic producer route exists. A same-action witness remains useful
				// when its bonus can satisfy demand beyond that action's guaranteed floor.
				const sameActionCanonicalQuantity =
					canonicalQuantityByActionId.get(action.actionId)?.get(itemId) ?? 0;
				if (
					action.outputMode === "existential" &&
					sameActionCanonicalQuantity === 0 &&
					(canonicalActionIdsByOutputItemId.get(itemId)?.size ?? 0) > 0
				)
					return [];
				const demand = demandByItemId.get(itemId);
				if (demand === undefined) return [];
				const satisfied = isGoalSatisfied(
					{
						itemId,
						minimumCharges: demand.minimumCharges,
						quantity: Math.max(1, demand.quantity),
					},
					execution.runtime,
				);
				return satisfied
					? []
					: [
							{
								itemId,
								priority: demand.priority,
							},
						];
			});
			const available = readCandidateAvailable(action, execution.runtime);
			if (demandedOutputs.length > 0) {
				const preferredDemandWitness =
					action.outputMode === "existential" &&
					demandedOutputs.some(({ itemId }) => {
						const demand = demandByItemId.get(itemId);
						const canonicalQuantity =
							canonicalQuantityByActionId.get(action.actionId)?.get(itemId) ?? 0;
						return (
							demand !== undefined &&
							canonicalQuantity > 0 &&
							demand.quantity - readRuntimeQuantity(execution.runtime, itemId) >
								canonicalQuantity
						);
					});
				candidates.push({
					action,
					available,
					demandPriority: Math.max(...demandedOutputs.map(({ priority }) => priority)),
					preferredDemandWitness,
					purpose: "demand",
					relevantOutputItemIds: demandedOutputs.map(({ itemId }) => itemId),
				});
				continue;
			}
			if (action.outputMode !== "canonical" || !available) continue;
			const unseenOutputItemIds = action.outputItemIds.filter(
				(itemId) => !discoveredItemIds.has(itemId),
			);
			if (unseenOutputItemIds.length === 0 || completedNoveltyCandidateIds.has(action.id))
				continue;
			const capabilityOutputItemIds = unseenOutputItemIds.filter((itemId) =>
				capabilityItemIds.has(itemId),
			);
			candidates.push({
				action,
				available,
				demandPriority: -1,
				preferredDemandWitness: false,
				purpose: capabilityOutputItemIds.length > 0 ? "capability" : "novelty",
				relevantOutputItemIds:
					capabilityOutputItemIds.length > 0
						? capabilityOutputItemIds
						: unseenOutputItemIds,
			});
		}
		maximumCandidateCount = Math.max(maximumCandidateCount, candidates.length);
		const selected = [
			...candidates,
		].sort(compareCandidates)[0];
		if (selected === undefined)
			return {
				bestAvailableQuantity: targetStatus.availableQuantity,
				bestExecution: execution,
				blockedActionIds: [
					...blockedActionIds,
				].sort(compareIds),
				diagnostics: readCurrentDiagnostics(),
				expandedActions: attemptedActions,
				reason: "search-exhausted",
				type: "inconclusive",
				unsupportedActionIds: [
					...unsupportedActionIds,
				].sort(compareIds),
				visitedWorlds,
			};

		attemptedActions += 1;
		const relevantRoutes = readCandidateRoutes({
			candidate: selected.action,
			relevantOutputItemIds: selected.relevantOutputItemIds,
			routeById,
		});
		const requirementGoals = (yield* Effect.forEach(relevantRoutes, (route) =>
			readRouteRequirementGoalsFx({
				graph,
				route,
				runtime: execution.runtime,
			}),
		))
			.flat()
			.filter(
				({ goal: requirementGoal }, index, goals) =>
					goals.findIndex(
						({ goal: candidateGoal }) =>
							candidateGoal.itemId === requirementGoal.itemId &&
							candidateGoal.quantity === requirementGoal.quantity &&
							(candidateGoal.minimumCharges ?? 0) ===
								(requirementGoal.minimumCharges ?? 0),
					) === index,
			);
		if (!selected.available || requirementGoals.length > 0) {
			for (const { goal: requirementGoal } of [
				...requirementGoals,
			].reverse())
				addDemand(requirementGoal);
			blockedFingerprintByCandidateId.set(selected.action.id, runtimeFingerprint);
			blockedActionIds.add(selected.action.actionId);
			continue;
		}

		const beforeRuntime = execution.runtime;
		const beforeQuantityByItemId = readRuntimeQuantityByItemId(beforeRuntime);
		const beforeDemandStatus = new Map(
			[
				...demandByItemId,
			].map(([itemId]) => [
				itemId,
				{
					charges: readRuntimeChargeCapacity(beforeRuntime, itemId),
					quantity: readRuntimeQuantity(beforeRuntime, itemId),
				},
			]),
		);
		const transition = yield* runPlannerSearchCandidateFx({
			candidate: selected.action,
			state: execution,
		});
		if (transition.type === "blocked") {
			const blockedRequirementGoals = (yield* Effect.forEach(relevantRoutes, (route) =>
				readRouteRequirementGoalsFx({
					graph,
					route,
					runtime: execution.runtime,
				}),
			)).flat();
			for (const { goal: requirementGoal } of [
				...blockedRequirementGoals,
			].reverse())
				addDemand(requirementGoal);
			blockedFingerprintByCandidateId.set(selected.action.id, runtimeFingerprint);
			blockedActionIds.add(selected.action.actionId);
			continue;
		}
		if (transition.type === "unsupported") {
			blockedFingerprintByCandidateId.set(selected.action.id, runtimeFingerprint);
			unsupportedActionIds.add(selected.action.actionId);
			continue;
		}
		if (!(yield* isPlannerRuntimeQuiescentFx(transition.state.runtime)))
			return {
				bestAvailableQuantity: targetStatus.availableQuantity,
				bestExecution: transition.state,
				blockedActionIds: [
					...blockedActionIds,
				].sort(compareIds),
				diagnostics: readCurrentDiagnostics(),
				expandedActions: attemptedActions,
				reason: "search-exhausted",
				type: "inconclusive",
				unsupportedActionIds: [
					...unsupportedActionIds,
				].sort(compareIds),
				visitedWorlds,
			};

		const previewDiscoveredItemIds = new Set(discoveredItemIds);
		for (const itemId of readRuntimeItemIds(transition.state.runtime))
			previewDiscoveredItemIds.add(itemId);
		const afterQuantityByItemId = readRuntimeQuantityByItemId(transition.state.runtime);
		const removedCapabilityItemIds = [
			...ownerOutputItemIdsByItemId.keys(),
		].filter(
			(itemId) =>
				(beforeQuantityByItemId.get(itemId) ?? 0) > 0 &&
				(afterQuantityByItemId.get(itemId) ?? 0) === 0,
		);
		const unseenRemovedCapabilityOutputs = removedCapabilityItemIds.flatMap((itemId) =>
			[
				...(ownerOutputItemIdsByItemId.get(itemId) ?? []),
			].filter((outputItemId) => !previewDiscoveredItemIds.has(outputItemId)),
		);
		if (unseenRemovedCapabilityOutputs.length > 0) {
			for (const itemId of unseenRemovedCapabilityOutputs)
				addDemand({
					itemId,
					quantity: 1,
				});
			blockedFingerprintByCandidateId.set(selected.action.id, runtimeFingerprint);
			deferredDestructiveActionIds.add(selected.action.actionId);
			continue;
		}

		const agendaViability = yield* readPlannerGoalAgendaViabilityFx({
			goals: [
				goal,
				...[
					...demandByItemId,
				].map(([itemId, demand]) => ({
					itemId,
					minimumCharges: demand.minimumCharges,
					quantity: Math.max(1, demand.quantity),
				})),
			],
			graph,
			runtime: transition.state.runtime,
		});
		if (agendaViability.type === "dead-end") {
			blockedFingerprintByCandidateId.set(selected.action.id, runtimeFingerprint);
			blockedActionIds.add(selected.action.actionId);
			continue;
		}

		const newItemIds = [
			...previewDiscoveredItemIds,
		].filter((itemId) => !discoveredItemIds.has(itemId));
		const demandProgress = [
			...demandByItemId,
		].some(([itemId]) => {
			const before = beforeDemandStatus.get(itemId) ?? {
				charges: 0,
				quantity: 0,
			};
			return (
				readRuntimeQuantity(transition.state.runtime, itemId) > before.quantity ||
				readRuntimeChargeCapacity(transition.state.runtime, itemId) > before.charges
			);
		});
		const lastTrace = transition.state.trace.at(-1);
		const chargeProgress =
			selected.purpose === "demand" &&
			(lastTrace?.spentChargeQuantities.some(({ charges }) => charges > 0) ?? false);
		if (newItemIds.length === 0 && !demandProgress && !chargeProgress) {
			completedNoveltyCandidateIds.add(selected.action.id);
			blockedFingerprintByCandidateId.set(selected.action.id, runtimeFingerprint);
			continue;
		}

		execution = transition.state;
		advancedActions += 1;
		visitedWorlds += 1;
		completedNoveltyCandidateIds.add(selected.action.id);
		blockedFingerprintByCandidateId.clear();
		for (const itemId of previewDiscoveredItemIds) discoveredItemIds.add(itemId);
		if (lastTrace !== undefined)
			for (const produced of lastTrace.producedItemQuantities)
				if (!availabilityByItemId.has(produced.itemId))
					availabilityByItemId.set(produced.itemId, execution.elapsedMs);
	}
});
