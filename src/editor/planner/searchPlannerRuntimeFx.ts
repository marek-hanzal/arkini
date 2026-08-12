import { Effect } from "effect";

import {
	DefaultPlannerSearchBudget,
	type PlannerSearchBudget,
	type PlannerSearchBudgetLimit,
	type PlannerSearchResult,
	type PlannerSearchTraceEntry,
} from "~/editor/planner/PlannerSearch";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import { isPlannerRuntimeQuiescent } from "~/editor/planner/isPlannerRuntimeQuiescent";
import { readPlannerExactRuntimeKey } from "~/editor/planner/readPlannerExactRuntimeKey";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
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
	readonly runtime: RuntimeSchema.Type;
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

const readOutputCertainty = (trace: ReadonlyArray<PlannerSearchTraceEntry>) =>
	trace.some(({ outputResolution }) => outputResolution.type === "existential")
		? ("possible" as const)
		: ("deterministic" as const);

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
	if (candidate.trace.length !== current.trace.length)
		return candidate.trace.length < current.trace.length;
	return candidate.elapsedMs < current.elapsedMs;
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
	const initial: SearchNode = {
		elapsedMs: 0,
		runtime,
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
	if (initialQuantity >= quantity)
		return {
			availableQuantity: initialQuantity,
			elapsedMs: 0,
			expandedStates: 0,
			itemId,
			outputCertainty: "deterministic",
			quantity,
			runtime,
			trace: [],
			type: "completed",
			visitedStates: 1,
		} satisfies PlannerSearchResult;

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
	const visitedRuntimeKeys = new Set<string>([
		readPlannerExactRuntimeKey(runtime),
	]);
	const queue: SearchNode[] = [
		initial,
	];
	let nextIndex = 0;
	let expandedStates = 0;
	let best = initial;
	let traceBudgetReached = false;

	while (nextIndex < queue.length) {
		if (expandedStates >= budget.maximumExpandedStates)
			return readInconclusive({
				best,
				blockedActionIds,
				budgetLimit: "maximumExpandedStates",
				expandedStates,
				frontierSize: queue.length - nextIndex,
				itemId,
				quantity,
				reason: "search-budget",
				scope,
				unsupportedActionIds,
				visitedStates: visitedRuntimeKeys.size,
			});

		const node = queue[nextIndex];
		nextIndex += 1;
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

			const next: SearchNode = {
				elapsedMs: node.elapsedMs + result.elapsedMs,
				runtime: result.runtime,
				trace: [
					...node.trace,
					{
						action: candidate.action,
						actionId: candidate.actionId,
						actor: result.actor,
						elapsedMs: result.elapsedMs,
						events: result.events,
						outputResolution:
							candidate.outputMode === "canonical"
								? {
										type: "canonical" as const,
									}
								: {
										outputItemId: candidate.outputWitness.outputItemId,
										routeId: candidate.outputWitness.routeId,
										type: "existential" as const,
										witnessId: candidate.outputWitness.witnessId,
									},
						outputItemIds: candidate.outputItemIds,
						routeIds: candidate.routeIds,
					},
				],
			};
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
					frontierSize: queue.length - nextIndex,
					itemId,
					quantity,
					reason: "non-quiescent-runtime",
					scope,
					unsupportedActionIds,
					visitedStates: visitedRuntimeKeys.size,
				});

			const runtimeKey = readPlannerExactRuntimeKey(next.runtime);
			const runtimeVisited = visitedRuntimeKeys.has(runtimeKey);
			const availableQuantity = readAvailableQuantity(next, itemId);
			if (availableQuantity >= quantity)
				return {
					availableQuantity,
					elapsedMs: next.elapsedMs,
					expandedStates,
					itemId,
					outputCertainty: readOutputCertainty(next.trace),
					quantity,
					runtime: next.runtime,
					trace: next.trace,
					type: "completed",
					visitedStates: visitedRuntimeKeys.size + Number(!runtimeVisited),
				} satisfies PlannerSearchResult;

			if (runtimeVisited) continue;
			visitedRuntimeKeys.add(runtimeKey);
			if (next.trace.length >= budget.maximumTraceLength) {
				traceBudgetReached = true;
				continue;
			}
			if (queue.length - nextIndex >= budget.maximumQueuedStates)
				return readInconclusive({
					best,
					blockedActionIds,
					budgetLimit: "maximumQueuedStates",
					expandedStates,
					frontierSize: queue.length - nextIndex,
					itemId,
					quantity,
					reason: "search-budget",
					scope,
					unsupportedActionIds,
					visitedStates: visitedRuntimeKeys.size,
				});
			queue.push(next);
		}
	}

	return readInconclusive({
		best,
		blockedActionIds,
		...(traceBudgetReached
			? {
					budgetLimit: "maximumTraceLength" as const,
				}
			: {}),
		expandedStates,
		frontierSize: 0,
		itemId,
		quantity,
		reason: traceBudgetReached
			? "search-budget"
			: unsupportedActionIds.size > 0
				? "action-unsupported"
				: scope.unsupportedRoutes.length > 0
					? "unsupported-routes"
					: "search-exhausted",
		scope,
		unsupportedActionIds,
		visitedStates: visitedRuntimeKeys.size,
	});
});
