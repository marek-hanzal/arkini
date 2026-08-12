import { Effect } from "effect";

import {
	DefaultPlannerSearchBudget,
	type PlannerSearchBudget,
	type PlannerSearchBudgetLimit,
	type PlannerSearchOutputCertainty,
	type PlannerSearchResult,
	type PlannerSearchTraceEntry,
} from "~/editor/planner/PlannerSearch";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import { createPlannerRuntimeDominanceIndex } from "~/editor/planner/createPlannerRuntimeDominanceIndex";
import { isPlannerRuntimeQuiescent } from "~/editor/planner/isPlannerRuntimeQuiescent";
import { readPlannerActionChargeFlowFx } from "~/editor/planner/readPlannerActionChargeFlowFx";
import { readPlannerActionItemFlowFx } from "~/editor/planner/readPlannerActionItemFlowFx";
import { readPlannerExpectedEconomicsFx } from "~/editor/planner/readPlannerExpectedEconomicsFx";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
import {
	comparePlannerSearchPriority,
	readPlannerSearchPriority,
	readPlannerSearchPriorityPlan,
	type PlannerSearchPriority,
} from "~/editor/planner/readPlannerSearchPriority";
import { readPlannerSearchScope } from "~/editor/planner/readPlannerSearchScope";
import { readPlannerStructuralReachability } from "~/editor/planner/readPlannerStructuralReachability";
import { runPlannerActionFx } from "~/editor/planner/runPlannerActionFx";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace searchPlannerRuntimeFx {
	export interface Props {
		readonly budget?: Partial<PlannerSearchBudget>;
		readonly graph: PlannerAcquisitionGraph;
		readonly itemId: IdSchema.Type;
		readonly quantity?: number;
		readonly runtime: RuntimeSchema.Type;
	}
}

interface SearchNode {
	readonly elapsedMs: number;
	readonly fingerprint: string;
	readonly order: number;
	readonly outputCertainty: PlannerSearchOutputCertainty;
	readonly priority: PlannerSearchPriority;
	readonly runtime: RuntimeSchema.Type;
	readonly selectedWitnessProbability: number;
	readonly stateToken: number;
	readonly trace: ReadonlyArray<PlannerSearchTraceEntry>;
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readPositiveBudget = (candidate: number | undefined, fallback: number) =>
	candidate === undefined || !Number.isFinite(candidate)
		? fallback
		: Math.max(1, Math.floor(candidate));

const readBudget = (budget: Partial<PlannerSearchBudget> | undefined): PlannerSearchBudget => ({
	maximumExpandedStates: readPositiveBudget(
		budget?.maximumExpandedStates,
		DefaultPlannerSearchBudget.maximumExpandedStates,
	),
	maximumQueuedStates: readPositiveBudget(
		budget?.maximumQueuedStates,
		DefaultPlannerSearchBudget.maximumQueuedStates,
	),
	maximumTraceLength: readPositiveBudget(
		budget?.maximumTraceLength,
		DefaultPlannerSearchBudget.maximumTraceLength,
	),
});

const readAvailableQuantity = (node: SearchNode, itemId: IdSchema.Type) =>
	readPlannerRuntimeQuantity(node.runtime, itemId);

const readOutputCertaintyRank = (certainty: PlannerSearchOutputCertainty) =>
	certainty === "deterministic" ? 0 : 1;

const compareSearchNodes = (left: SearchNode, right: SearchNode) =>
	comparePlannerSearchPriority(left.priority, right.priority) ||
	readOutputCertaintyRank(left.outputCertainty) -
		readOutputCertaintyRank(right.outputCertainty) ||
	left.trace.length - right.trace.length ||
	left.elapsedMs - right.elapsedMs ||
	right.selectedWitnessProbability - left.selectedWitnessProbability ||
	left.order - right.order;

const readNextOutputCertainty = (
	current: PlannerSearchOutputCertainty,
	outputWitnessResolved: boolean,
): PlannerSearchOutputCertainty =>
	current === "possible" || outputWitnessResolved ? "possible" : "deterministic";

const readRelevantPresence = (node: SearchNode, scope: PlannerSearchScope) =>
	scope.itemIds.reduce(
		(total, itemId) => total + Number(readPlannerRuntimeQuantity(node.runtime, itemId) > 0),
		0,
	);

const isBetterNode = ({
	candidate,
	current,
	itemId,
	scope,
}: {
	readonly candidate: SearchNode;
	readonly current: SearchNode;
	readonly itemId: IdSchema.Type;
	readonly scope: PlannerSearchScope;
}) => {
	const candidateQuantity = readAvailableQuantity(candidate, itemId);
	const currentQuantity = readAvailableQuantity(current, itemId);
	if (candidateQuantity !== currentQuantity) return candidateQuantity > currentQuantity;
	const candidatePresence = readRelevantPresence(candidate, scope);
	const currentPresence = readRelevantPresence(current, scope);
	if (candidatePresence !== currentPresence) return candidatePresence > currentPresence;
	const certaintyDifference =
		readOutputCertaintyRank(candidate.outputCertainty) -
		readOutputCertaintyRank(current.outputCertainty);
	if (certaintyDifference !== 0) return certaintyDifference < 0;
	if (candidate.trace.length !== current.trace.length)
		return candidate.trace.length < current.trace.length;
	if (candidate.elapsedMs !== current.elapsedMs) return candidate.elapsedMs < current.elapsedMs;
	return candidate.selectedWitnessProbability > current.selectedWitnessProbability;
};

const removeDominatedQueueNodes = (
	queue: SearchNode[],
	index: ReturnType<typeof createPlannerRuntimeDominanceIndex>,
) => queue.filter((node) => index.isActive(node.fingerprint, node.stateToken));

const pruneQueueToBudget = ({
	index,
	maximumQueuedStates,
	queue,
}: {
	readonly index: ReturnType<typeof createPlannerRuntimeDominanceIndex>;
	readonly maximumQueuedStates: number;
	readonly queue: SearchNode[];
}) => {
	const active = removeDominatedQueueNodes(queue, index).sort(compareSearchNodes);
	if (active.length <= maximumQueuedStates)
		return {
			pruned: false,
			queue: active,
		};

	for (const node of active.slice(maximumQueuedStates))
		index.deactivate(node.fingerprint, node.stateToken);
	return {
		pruned: true,
		queue: active.slice(0, maximumQueuedStates),
	};
};

const readInconclusive = ({
	best,
	blockedActionIds,
	budgetLimit,
	expandedStates,
	frontierSize,
	itemId,
	quantity,
	reason,
	scope,
	unsupportedActionIds,
	visitedStates,
}: {
	readonly best: SearchNode;
	readonly blockedActionIds: ReadonlySet<string>;
	readonly budgetLimit?: PlannerSearchBudgetLimit;
	readonly expandedStates: number;
	readonly frontierSize: number;
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
	readonly reason: Extract<
		PlannerSearchResult,
		{
			readonly type: "inconclusive";
		}
	>["reason"];
	readonly scope: PlannerSearchScope;
	readonly unsupportedActionIds: ReadonlySet<string>;
	readonly visitedStates: number;
}): PlannerSearchResult => ({
	bestAvailableQuantity: readAvailableQuantity(best, itemId),
	bestRuntime: best.runtime,
	blockedActionIds: [
		...blockedActionIds,
	].sort(compareIds),
	...(budgetLimit === undefined
		? {}
		: {
				budgetLimit,
			}),
	expandedStates,
	frontierSize,
	itemId,
	quantity,
	reason,
	trace: best.trace,
	type: "inconclusive",
	unsupportedActionIds: [
		...unsupportedActionIds,
	].sort(compareIds),
	unsupportedRoutes: scope.unsupportedRoutes,
	visitedStates,
});

/**
 * Searches forward through immutable runtime snapshots and delegates every transition to engine.
 *
 * Stochastic routes execute as explicit positive-probability output witnesses. Exhausted search is
 * inconclusive; only the optimistic acquisition graph may prove `no-finite-path`.
 */
export const searchPlannerRuntimeFx = Effect.fn("searchPlannerRuntimeFx")(function* ({
	budget: budgetOverride,
	graph,
	itemId,
	quantity = 1,
	runtime,
}: searchPlannerRuntimeFx.Props) {
	if (!Number.isSafeInteger(quantity) || quantity < 1)
		return yield* Effect.die(
			new RangeError(
				`Planner target quantity must be a positive safe integer, received ${quantity}.`,
			),
		);

	const scope = readPlannerSearchScope({
		graph,
		targetItemId: itemId,
	});
	const priorityPlan = readPlannerSearchPriorityPlan({
		graph,
		scope,
	});
	const dominanceIndex = createPlannerRuntimeDominanceIndex();
	const initialRegistration = dominanceIndex.register({
		label: {
			elapsedMs: 0,
			outputCertainty: "deterministic",
			selectedWitnessProbability: 1,
			traceLength: 0,
		},
		runtime,
	});
	if (!initialRegistration.accepted)
		return yield* Effect.die(new Error("Planner rejected its initial runtime state."));
	const initial: SearchNode = {
		elapsedMs: 0,
		fingerprint: initialRegistration.fingerprint,
		order: 0,
		outputCertainty: "deterministic",
		priority: readPlannerSearchPriority({
			itemId,
			plan: priorityPlan,
			quantity,
			runtime,
			scope,
		}),
		runtime,
		selectedWitnessProbability: 1,
		stateToken: initialRegistration.token,
		trace: [],
	};
	if (!isPlannerRuntimeQuiescent(runtime))
		return readInconclusive({
			best: initial,
			blockedActionIds: new Set(),
			expandedStates: 0,
			frontierSize: 0,
			itemId,
			quantity,
			reason: "non-quiescent-runtime",
			scope,
			unsupportedActionIds: new Set(),
			visitedStates: 1,
		});

	const initialQuantity = readAvailableQuantity(initial, itemId);
	if (initialQuantity >= quantity) {
		const economics = yield* readPlannerExpectedEconomicsFx({
			initialRuntime: runtime,
			itemId,
			quantity,
			trace: [],
		});
		return {
			availableQuantity: initialQuantity,
			economics,
			elapsedMs: 0,
			expandedStates: 0,
			itemId,
			outputCertainty: "deterministic",
			quantity,
			runtime,
			selectedWitnessProbability: 1,
			trace: [],
			type: "completed",
			visitedStates: 1,
		} satisfies PlannerSearchResult;
	}

	const structural = readPlannerStructuralReachability({
		graph,
		itemId,
	});
	if (structural.type !== "reachable")
		return {
			itemId,
			proof: structural,
			quantity,
			type: "no-finite-path",
		} satisfies PlannerSearchResult;

	if (!scope.supported)
		return readInconclusive({
			best: initial,
			blockedActionIds: new Set(),
			expandedStates: 0,
			frontierSize: 0,
			itemId,
			quantity,
			reason: "unsupported-routes",
			scope,
			unsupportedActionIds: new Set(),
			visitedStates: 1,
		});

	const budget = readBudget(budgetOverride);
	const blockedActionIds = new Set<string>();
	const unsupportedActionIds = new Set<string>();
	let queue: SearchNode[] = [
		initial,
	];
	let expandedStates = 0;
	let best = initial;
	let nextOrder = 1;
	let queueBudgetPruned = false;
	let traceBudgetReached = false;

	while (queue.length > 0) {
		queue = removeDominatedQueueNodes(queue, dominanceIndex);
		if (queue.length === 0) break;
		if (expandedStates >= budget.maximumExpandedStates)
			return readInconclusive({
				best,
				blockedActionIds,
				budgetLimit: "maximumExpandedStates",
				expandedStates,
				frontierSize: queue.length,
				itemId,
				quantity,
				reason: "search-budget",
				scope,
				unsupportedActionIds,
				visitedStates: dominanceIndex.readFingerprintCount(),
			});

		queue.sort(compareSearchNodes);
		const node = queue.shift();
		if (node === undefined) continue;
		if (node.trace.length >= budget.maximumTraceLength) {
			traceBudgetReached = true;
			continue;
		}
		expandedStates += 1;

		for (const candidate of scope.actions) {
			const result = yield* runPlannerActionFx({
				action: candidate.action,
				outputWitness: candidate.outputWitness,
				runtime: node.runtime,
			});
			if (result.type === "blocked") {
				blockedActionIds.add(candidate.id);
				continue;
			}
			if (result.type === "unsupported") {
				unsupportedActionIds.add(candidate.id);
				continue;
			}

			const outputWitnessResolved =
				candidate.outputMode === "existential" && result.outputWitnessResolved;
			const nextSelectedWitnessProbability =
				node.selectedWitnessProbability *
				(outputWitnessResolved
					? candidate.outputWitness.statistics.maximumQuantityProbability
					: 1);
			const itemFlow = yield* readPlannerActionItemFlowFx({
				after: result.runtime,
				before: node.runtime,
			});
			const spentChargeQuantities = yield* readPlannerActionChargeFlowFx({
				before: node.runtime,
				events: result.events,
			});
			const nextTrace: ReadonlyArray<PlannerSearchTraceEntry> = [
				...node.trace,
				{
					action: candidate.action,
					actionId: candidate.actionId,
					actor: result.actor,
					consumedItemQuantities: itemFlow.consumedItemQuantities,
					elapsedMs: result.elapsedMs,
					events: result.events,
					outputResolution: outputWitnessResolved
						? {
								outputItemId: candidate.outputWitness.outputItemId,
								routeId: candidate.outputWitness.routeId,
								statistics: candidate.outputWitness.statistics,
								type: "existential" as const,
								witnessId: candidate.outputWitness.witnessId,
							}
						: {
								type: "canonical" as const,
							},
					outputItemIds: candidate.outputItemIds,
					producedItemQuantities: itemFlow.producedItemQuantities,
					routeIds: candidate.routeIds,
					spentChargeQuantities,
				},
			];
			const nextElapsedMs = node.elapsedMs + result.elapsedMs;
			const nextOutputCertainty = readNextOutputCertainty(
				node.outputCertainty,
				outputWitnessResolved,
			);
			const registration = dominanceIndex.register({
				label: {
					elapsedMs: nextElapsedMs,
					outputCertainty: nextOutputCertainty,
					selectedWitnessProbability: nextSelectedWitnessProbability,
					traceLength: nextTrace.length,
				},
				runtime: result.runtime,
			});
			if (!registration.accepted) continue;
			const next: SearchNode = {
				elapsedMs: nextElapsedMs,
				fingerprint: registration.fingerprint,
				order: nextOrder,
				outputCertainty: nextOutputCertainty,
				priority: readPlannerSearchPriority({
					itemId,
					plan: priorityPlan,
					quantity,
					runtime: result.runtime,
					scope,
				}),
				runtime: result.runtime,
				selectedWitnessProbability: nextSelectedWitnessProbability,
				stateToken: registration.token,
				trace: nextTrace,
			};
			nextOrder += 1;
			if (
				isBetterNode({
					candidate: next,
					current: best,
					itemId,
					scope,
				})
			)
				best = next;
			if (!isPlannerRuntimeQuiescent(next.runtime))
				return readInconclusive({
					best: next,
					blockedActionIds,
					expandedStates,
					frontierSize: queue.length,
					itemId,
					quantity,
					reason: "non-quiescent-runtime",
					scope,
					unsupportedActionIds,
					visitedStates: dominanceIndex.readFingerprintCount(),
				});

			const availableQuantity = readAvailableQuantity(next, itemId);
			if (availableQuantity >= quantity) {
				const economics = yield* readPlannerExpectedEconomicsFx({
					initialRuntime: runtime,
					itemId,
					quantity,
					trace: next.trace,
				});
				return {
					availableQuantity,
					economics,
					elapsedMs: next.elapsedMs,
					expandedStates,
					itemId,
					outputCertainty: next.outputCertainty,
					quantity,
					runtime: next.runtime,
					selectedWitnessProbability: next.selectedWitnessProbability,
					trace: next.trace,
					type: "completed",
					visitedStates: dominanceIndex.readFingerprintCount(),
				} satisfies PlannerSearchResult;
			}

			if (next.trace.length >= budget.maximumTraceLength) {
				traceBudgetReached = true;
				continue;
			}
			const boundedQueue = pruneQueueToBudget({
				index: dominanceIndex,
				maximumQueuedStates: budget.maximumQueuedStates,
				queue: [
					...queue,
					next,
				],
			});
			queue = boundedQueue.queue;
			queueBudgetPruned ||= boundedQueue.pruned;
		}
	}

	return readInconclusive({
		best,
		blockedActionIds,
		...(traceBudgetReached || queueBudgetPruned
			? {
					budgetLimit: traceBudgetReached
						? ("maximumTraceLength" as const)
						: ("maximumQueuedStates" as const),
				}
			: {}),
		expandedStates,
		frontierSize: 0,
		itemId,
		quantity,
		reason:
			traceBudgetReached || queueBudgetPruned
				? "search-budget"
				: unsupportedActionIds.size > 0
					? "action-unsupported"
					: scope.unsupportedRoutes.length > 0
						? "unsupported-routes"
						: "search-exhausted",
		scope,
		unsupportedActionIds,
		visitedStates: dominanceIndex.readFingerprintCount(),
	});
});
