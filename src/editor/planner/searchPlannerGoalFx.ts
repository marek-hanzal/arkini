import { Effect } from "effect";

import type { PlannerBudgetExceeded } from "~/editor/planner/PlannerBudget";
import type { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import type {
	PlannerGoalSearchBudget,
	PlannerGoalSearchDiagnostics,
	PlannerGoalSearchResult,
	PlannerGoalSearchSubgoalSolver,
} from "~/editor/planner/PlannerGoalSearch";
import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerStrategyInconclusiveReason } from "~/editor/planner/PlannerStrategy";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import { expandPlannerGoalSearchBranchFx } from "~/editor/planner/expandPlannerGoalSearchBranchFx";
import { isPlannerRuntimeQuiescentFx } from "~/editor/planner/isPlannerRuntimeQuiescentFx";
import { readPlannerGoalSearchBudgetFx } from "~/editor/planner/readPlannerGoalSearchBudgetFx";
import { readPlannerGoalViabilityFx } from "~/editor/planner/readPlannerGoalViabilityFx";
import { readPlannerItemGoalStatusFx } from "~/editor/planner/readPlannerItemGoalStatusFx";
import { readPlannerRuntimeFingerprintFx } from "~/editor/planner/readPlannerRuntimeFingerprintFx";
import { readPlannerStructuralReachabilityFx } from "~/editor/planner/readPlannerStructuralReachabilityFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace searchPlannerGoalFx {
	export interface Props {
		readonly budget?: Partial<PlannerGoalSearchBudget>;
		readonly graph: PlannerAcquisitionGraph;
		readonly itemId: IdSchema.Type;
		readonly minimumCharges?: number;
		readonly quantity?: number;
		readonly runtime: RuntimeSchema.Type;
		readonly solveSubgoalFx?: PlannerGoalSearchSubgoalSolver;
	}
}

type PlannerResourceGoalTask = expandPlannerGoalSearchBranchFx.ResourceGoalTask;
type PlannerGoalTask = expandPlannerGoalSearchBranchFx.Task;
type PlannerGoalBranch = expandPlannerGoalSearchBranchFx.Branch;
type PlannerBranchExpansion = expandPlannerGoalSearchBranchFx.Result;

interface PlannerGoalSearchCounters {
	attemptedActions: number;
	backtracks: number;
	blockedBranches: number;
	createdBranches: number;
	deadEndBranches: number;
	delegatedCompletedSubgoals: number;
	delegatedExpandedNodes: number;
	delegatedInconclusiveSubgoals: number;
	delegatedMaximumFrontierSize: number;
	delegatedNoFinitePathSubgoals: number;
	delegatedSubgoals: number;
	delegatedVisitedNodes: number;
	duplicateBranches: number;
	expandedBranches: number;
	maximumAgendaDepth: number;
	maximumFrontierSize: number;
	unsupportedBranches: number;
}

type PlannerBranchBatchResult =
	| {
			readonly branch: PlannerGoalBranch;
			readonly expansion: PlannerBranchExpansion;
			readonly type: "expanded";
	  }
	| {
			readonly branch: PlannerGoalBranch;
			readonly limit: "maximumAgendaDepth" | "maximumTraceLength";
			readonly type: "budget";
	  };

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readRuntimeQuantity = (runtime: RuntimeSchema.Type, itemId: IdSchema.Type) => {
	let quantity = 0;
	for (const item of runtime.items) if (item.item.id === itemId) quantity += item.quantity;
	return quantity;
};

const readInitialExecution = (runtime: RuntimeSchema.Type): PlannerSearchExecutionState => ({
	elapsedMs: 0,
	outputCertainty: "deterministic",
	runtime,
	selectedWitnessProbability: 1,
	trace: [],
});

const readInitialResourceGoal = (
	itemId: IdSchema.Type,
	quantity: number,
	minimumCharges: number,
): PlannerResourceGoalTask => ({
	itemId,
	minimumCharges,
	minimumQuantity: quantity,
	resolution: "local",
	type: "resource",
});

const readTaskSignature = (task: PlannerGoalTask) => {
	switch (task.type) {
		case "resource":
			return [
				"resource",
				task.itemId,
				task.minimumQuantity,
				task.minimumCharges,
				task.resolution,
			];
		case "route":
			return [
				"route",
				task.route.id,
				task.candidate.id,
			];
	}
};

const compareChoicePaths = (left: ReadonlyArray<number>, right: ReadonlyArray<number>) => {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return left.length - right.length;
};

const isBetterBranch = (
	candidate: PlannerGoalBranch,
	current: PlannerGoalBranch,
	targetItemId: IdSchema.Type,
) => {
	const candidateQuantity = readRuntimeQuantity(candidate.execution.runtime, targetItemId);
	const currentQuantity = readRuntimeQuantity(current.execution.runtime, targetItemId);
	if (candidateQuantity !== currentQuantity) return candidateQuantity > currentQuantity;
	if (candidate.agenda.length !== current.agenda.length)
		return candidate.agenda.length < current.agenda.length;
	if (candidate.execution.trace.length !== current.execution.trace.length)
		return candidate.execution.trace.length < current.execution.trace.length;
	return compareChoicePaths(candidate.choicePath, current.choicePath) < 0;
};

const expandPlannerGoalBranchWithinBudgetFx = Effect.fn("expandPlannerGoalBranchWithinBudgetFx")(
	function* ({
		branch,
		budget,
		graph,
		solveSubgoalFx,
		targetGoal,
	}: {
		readonly branch: PlannerGoalBranch;
		readonly budget: PlannerGoalSearchBudget;
		readonly graph: PlannerAcquisitionGraph;
		readonly solveSubgoalFx?: PlannerGoalSearchSubgoalSolver;
		readonly targetGoal: PlannerItemGoal;
	}): Effect.fn.Return<
		PlannerBranchBatchResult,
		PlannerBudgetExceeded,
		GameConfigFx | PlannerBudgetFx
	> {
		if ((yield* readPlannerItemGoalStatusFx(targetGoal, branch.execution.runtime)).satisfied)
			return {
				branch,
				expansion: {
					branch,
					type: "completed",
				},
				type: "expanded",
			};
		if (branch.execution.trace.length >= budget.maximumTraceLength)
			return {
				branch,
				limit: "maximumTraceLength",
				type: "budget",
			};
		if (branch.agenda.length > budget.maximumAgendaDepth)
			return {
				branch,
				limit: "maximumAgendaDepth",
				type: "budget",
			};

		return {
			branch,
			expansion: yield* expandPlannerGoalSearchBranchFx({
				branch,
				graph,
				solveSubgoalFx,
				targetGoal,
			}),
			type: "expanded",
		};
	},
);

const readCounters = (): PlannerGoalSearchCounters => ({
	attemptedActions: 0,
	backtracks: 0,
	blockedBranches: 0,
	createdBranches: 1,
	deadEndBranches: 0,
	delegatedCompletedSubgoals: 0,
	delegatedExpandedNodes: 0,
	delegatedInconclusiveSubgoals: 0,
	delegatedMaximumFrontierSize: 0,
	delegatedNoFinitePathSubgoals: 0,
	delegatedSubgoals: 0,
	delegatedVisitedNodes: 0,
	duplicateBranches: 0,
	expandedBranches: 0,
	maximumAgendaDepth: 1,
	maximumFrontierSize: 1,
	unsupportedBranches: 0,
});

const readDiagnostics = ({
	budget,
	counters,
	winningChoicePath,
}: {
	readonly budget: PlannerGoalSearchBudget;
	readonly counters: PlannerGoalSearchCounters;
	readonly winningChoicePath?: ReadonlyArray<number>;
}): PlannerGoalSearchDiagnostics => ({
	...counters,
	maximumConcurrentBranches: budget.maximumConcurrentBranches,
	...(winningChoicePath === undefined
		? {}
		: {
				winningChoicePath,
			}),
});

const readBudgetLimit = (limits: ReadonlySet<string>): string | undefined => {
	const order: ReadonlyArray<string> = [
		"maximumExpandedBranches",
		"maximumQueuedBranches",
		"maximumTraceLength",
		"maximumAgendaDepth",
		"maximumExpandedStates",
		"maximumQueuedStates",
		"maximumRoutePlans",
		"engine-transitions",
		"strategy-invocations",
		"delegation-depth",
	];
	return (
		order.find((limit) => limits.has(limit)) ??
		[
			...limits,
		].sort(compareIds)[0]
	);
};

const readInconclusive = ({
	best,
	blockedActionIds,
	budget,
	budgetLimits,
	counters,
	frontierSize,
	itemId,
	quantity,
	reason,
	unsupportedActionIds,
}: {
	readonly best: PlannerGoalBranch;
	readonly blockedActionIds: ReadonlySet<string>;
	readonly budget: PlannerGoalSearchBudget;
	readonly budgetLimits: ReadonlySet<string>;
	readonly counters: PlannerGoalSearchCounters;
	readonly frontierSize: number;
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
	readonly reason: Extract<
		PlannerGoalSearchResult,
		{
			readonly type: "inconclusive";
		}
	>["reason"];
	readonly unsupportedActionIds: ReadonlySet<string>;
}): PlannerGoalSearchResult => {
	const budgetLimit = readBudgetLimit(budgetLimits);
	return {
		bestAvailableQuantity: readRuntimeQuantity(best.execution.runtime, itemId),
		bestExecution: best.execution,
		blockedActionIds: [
			...blockedActionIds,
		].sort(compareIds),
		...(budgetLimit === undefined
			? {}
			: {
					budgetLimit,
				}),
		diagnostics: readDiagnostics({
			budget,
			counters,
		}),
		frontierSize,
		itemId,
		quantity,
		reason,
		type: "inconclusive",
		unsupportedActionIds: [
			...unsupportedActionIds,
		].sort(compareIds),
	};
};

/**
 * Builds one concrete plan through branch-local immutable runtime snapshots.
 *
 * The acquisition graph chooses resource routes; the canonical engine decides every transition.
 * Sibling branches are expanded concurrently in deterministic waves and dead futures are discarded
 * by re-rooting structural viability in their resulting snapshots.
 */
export const searchPlannerGoalFx = Effect.fn("searchPlannerGoalFx")(function* ({
	budget: budgetOverride,
	graph,
	itemId,
	minimumCharges = 0,
	quantity = 1,
	runtime,
	solveSubgoalFx,
}: searchPlannerGoalFx.Props) {
	if (!Number.isSafeInteger(quantity) || quantity < 1)
		return yield* Effect.die(
			new RangeError(
				`Planner target quantity must be a positive safe integer, received ${quantity}.`,
			),
		);
	if (!Number.isSafeInteger(minimumCharges) || minimumCharges < 0)
		return yield* Effect.die(
			new RangeError(
				`Planner target minimum charges must be a non-negative safe integer, received ${minimumCharges}.`,
			),
		);

	const budget = yield* readPlannerGoalSearchBudgetFx(budgetOverride);
	const targetGoal: PlannerItemGoal = {
		itemId,
		minimumCharges,
		quantity,
	};
	const initialExecution = readInitialExecution(runtime);
	const initial: PlannerGoalBranch = {
		agenda: [
			readInitialResourceGoal(itemId, quantity, minimumCharges),
		],
		choicePath: [],
		execution: initialExecution,
	};
	const branchKeyByBranch = new WeakMap<PlannerGoalBranch, string>();
	const readBranchKeyFx = Effect.fn("searchPlannerGoalFx.readBranchKeyFx")(function* (
		branch: PlannerGoalBranch,
	) {
		const cached = branchKeyByBranch.get(branch);
		if (cached !== undefined) return cached;
		const stateSignature = [
			yield* readPlannerRuntimeFingerprintFx(branch.execution.runtime),
			branch.execution.outputCertainty,
			branch.agenda.map(readTaskSignature),
		];
		const fallbackSignatures: unknown[] = [];
		const seen = new Set<PlannerGoalBranch>();
		let fallback = branch.fallback;
		while (fallback !== undefined && !seen.has(fallback)) {
			seen.add(fallback);
			fallbackSignatures.push([
				yield* readPlannerRuntimeFingerprintFx(fallback.execution.runtime),
				fallback.execution.outputCertainty,
				fallback.agenda.map(readTaskSignature),
			]);
			fallback = fallback.fallback;
		}
		const key = JSON.stringify([
			stateSignature,
			fallbackSignatures,
		]);
		branchKeyByBranch.set(branch, key);
		return key;
	});
	const compareBranches = (left: PlannerGoalBranch, right: PlannerGoalBranch) => {
		const leftKey = branchKeyByBranch.get(left);
		const rightKey = branchKeyByBranch.get(right);
		if (leftKey === undefined || rightKey === undefined)
			throw new Error("Planner branch comparison requires a precomputed canonical key.");
		return (
			compareChoicePaths(left.choicePath, right.choicePath) ||
			left.agenda.length - right.agenda.length ||
			left.execution.trace.length - right.execution.trace.length ||
			compareIds(leftKey, rightKey)
		);
	};
	const counters = readCounters();
	const emptyDiagnostics = readDiagnostics({
		budget,
		counters,
	});

	if (!(yield* isPlannerRuntimeQuiescentFx(runtime)))
		return {
			bestAvailableQuantity: readRuntimeQuantity(runtime, itemId),
			bestExecution: initialExecution,
			blockedActionIds: [],
			diagnostics: emptyDiagnostics,
			frontierSize: 0,
			itemId,
			quantity,
			reason: "non-quiescent-runtime",
			type: "inconclusive",
			unsupportedActionIds: [],
		} satisfies PlannerGoalSearchResult;

	const structural = yield* readPlannerStructuralReachabilityFx({
		graph,
		itemId,
	});
	if (structural.type !== "reachable")
		return {
			diagnostics: emptyDiagnostics,
			itemId,
			proof: structural,
			quantity,
			type: "no-finite-path",
		} satisfies PlannerGoalSearchResult;

	const initialViability = yield* readPlannerGoalViabilityFx({
		goal: targetGoal,
		graph,
		runtime,
	});
	if (initialViability.type === "dead-end")
		return {
			diagnostics: emptyDiagnostics,
			itemId,
			proof: initialViability.proof,
			quantity,
			type: "no-finite-path",
		} satisfies PlannerGoalSearchResult;
	if (initialViability.type === "satisfied")
		return {
			availableQuantity: initialViability.availableQuantity,
			diagnostics: emptyDiagnostics,
			execution: initialExecution,
			itemId,
			quantity,
			type: "completed",
		} satisfies PlannerGoalSearchResult;

	const blockedActionIds = new Set<string>();
	const unsupportedActionIds = new Set<string>();
	const budgetLimits = new Set<string>();
	const delegatedReasons = new Set<PlannerStrategyInconclusiveReason>();
	const visited = new Set<string>([
		yield* readBranchKeyFx(initial),
	]);
	let queue: PlannerGoalBranch[] = [
		initial,
	];
	let completions: PlannerGoalBranch[] = [];
	let best = initial;

	const readDeterministicCompletion = () => {
		if (completions.length === 0) return undefined;
		completions.sort(compareBranches);
		queue.sort(compareBranches);
		const completion = completions[0];
		const pending = queue[0];
		return completion !== undefined &&
			(pending === undefined || compareBranches(completion, pending) < 0)
			? completion
			: undefined;
	};

	while (queue.length > 0) {
		const readyCompletion = readDeterministicCompletion();
		if (readyCompletion !== undefined)
			return {
				availableQuantity: readRuntimeQuantity(readyCompletion.execution.runtime, itemId),
				diagnostics: readDiagnostics({
					budget,
					counters,
					winningChoicePath: readyCompletion.choicePath,
				}),
				execution: readyCompletion.execution,
				itemId,
				quantity,
				type: "completed",
			} satisfies PlannerGoalSearchResult;

		if (counters.expandedBranches >= budget.maximumExpandedBranches) {
			budgetLimits.add("maximumExpandedBranches");
			break;
		}

		queue.sort(compareBranches);
		const remainingExpansionBudget = budget.maximumExpandedBranches - counters.expandedBranches;
		const batchSize = Math.min(
			budget.maximumConcurrentBranches,
			remainingExpansionBudget,
			queue.length,
		);
		const batch = queue.splice(0, batchSize);
		const expansions = yield* Effect.forEach(
			batch,
			(branch) =>
				expandPlannerGoalBranchWithinBudgetFx({
					branch,
					budget,
					graph,
					solveSubgoalFx,
					targetGoal,
				}),
			{
				concurrency: budget.maximumConcurrentBranches,
			},
		);
		counters.expandedBranches += batch.length;
		const producedChildren: PlannerGoalBranch[] = [];
		const addFallback = (branch: PlannerGoalBranch) => {
			if (branch.fallback !== undefined) producedChildren.push(branch.fallback);
		};

		for (const result of expansions) {
			if (result.type === "budget") {
				budgetLimits.add(result.limit);
				counters.backtracks += 1;
				addFallback(result.branch);
				continue;
			}
			const expansion = result.expansion;
			if (expansion.attemptedActionId !== undefined) counters.attemptedActions += 1;
			if (expansion.delegatedSubgoal !== undefined) {
				const delegated = expansion.delegatedSubgoal;
				counters.delegatedSubgoals += 1;
				counters.delegatedExpandedNodes += delegated.metrics.expandedNodes;
				counters.delegatedVisitedNodes += delegated.metrics.visitedNodes;
				counters.delegatedMaximumFrontierSize = Math.max(
					counters.delegatedMaximumFrontierSize,
					delegated.metrics.frontierSize,
				);
				if (delegated.outcome === "completed") counters.delegatedCompletedSubgoals += 1;
				if (delegated.outcome === "no-finite-path")
					counters.delegatedNoFinitePathSubgoals += 1;
				if (delegated.outcome === "inconclusive")
					counters.delegatedInconclusiveSubgoals += 1;
				if (delegated.budgetLimit !== undefined) budgetLimits.add(delegated.budgetLimit);
				if (delegated.reason !== undefined) delegatedReasons.add(delegated.reason);
				for (const actionId of delegated.blockedActionIds) blockedActionIds.add(actionId);
				for (const actionId of delegated.unsupportedActionIds)
					unsupportedActionIds.add(actionId);
			}
			if (expansion.type === "completed") {
				yield* readBranchKeyFx(expansion.branch);
				completions.push(expansion.branch);
				continue;
			}
			if (expansion.type === "non-quiescent")
				return readInconclusive({
					best: expansion.branch,
					blockedActionIds,
					budget,
					budgetLimits,
					counters,
					frontierSize: queue.length,
					itemId,
					quantity,
					reason: "non-quiescent-runtime",
					unsupportedActionIds,
				});
			if (expansion.type === "unresolved") {
				counters.backtracks += 1;
				addFallback(result.branch);
				continue;
			}
			if (expansion.type === "dead") {
				counters.deadEndBranches += 1;
				counters.backtracks += 1;
				if (expansion.reason === "blocked") {
					counters.blockedBranches += 1;
					if (expansion.attemptedActionId !== undefined)
						blockedActionIds.add(expansion.attemptedActionId);
				}
				if (expansion.reason === "unsupported") {
					counters.unsupportedBranches += 1;
					if (expansion.attemptedActionId !== undefined)
						unsupportedActionIds.add(expansion.attemptedActionId);
				}
				addFallback(result.branch);
				continue;
			}

			const pendingChildren = [
				...expansion.children,
			];
			for (let index = 0; index < pendingChildren.length; index += 1) {
				const child = pendingChildren[index];
				if (child === undefined) continue;
				counters.createdBranches += 1;
				counters.maximumAgendaDepth = Math.max(
					counters.maximumAgendaDepth,
					child.agenda.length,
				);
				if (child.agenda.length > budget.maximumAgendaDepth) {
					budgetLimits.add("maximumAgendaDepth");
					if (child.fallback !== undefined) pendingChildren.push(child.fallback);
					continue;
				}
				if (child.execution.trace.length > budget.maximumTraceLength) {
					budgetLimits.add("maximumTraceLength");
					if (child.fallback !== undefined) pendingChildren.push(child.fallback);
					continue;
				}
				const key = yield* readBranchKeyFx(child);
				if (visited.has(key)) {
					counters.duplicateBranches += 1;
					if (child.fallback !== undefined) pendingChildren.push(child.fallback);
					continue;
				}
				visited.add(key);
				if (isBetterBranch(child, best, itemId)) best = child;
				producedChildren.push(child);
			}
		}

		for (const branch of producedChildren) yield* readBranchKeyFx(branch);
		queue = [
			...queue,
			...producedChildren,
		].sort(compareBranches);
		if (queue.length > budget.maximumQueuedBranches) {
			budgetLimits.add("maximumQueuedBranches");
			queue = queue.slice(0, budget.maximumQueuedBranches);
		}
		counters.maximumFrontierSize = Math.max(counters.maximumFrontierSize, queue.length);
	}

	const completion = readDeterministicCompletion() ?? completions.sort(compareBranches)[0];
	if (completion !== undefined)
		return {
			availableQuantity: readRuntimeQuantity(completion.execution.runtime, itemId),
			diagnostics: readDiagnostics({
				budget,
				counters,
				winningChoicePath: completion.choicePath,
			}),
			execution: completion.execution,
			itemId,
			quantity,
			type: "completed",
		} satisfies PlannerGoalSearchResult;

	return readInconclusive({
		best,
		blockedActionIds,
		budget,
		budgetLimits,
		counters,
		frontierSize: queue.length,
		itemId,
		quantity,
		reason:
			budgetLimits.size > 0
				? "search-budget"
				: delegatedReasons.has("non-quiescent-runtime")
					? "non-quiescent-runtime"
					: unsupportedActionIds.size > 0 ||
							delegatedReasons.has("action-unsupported") ||
							delegatedReasons.has("unsupported-routes")
						? "action-unsupported"
						: "search-exhausted",
		unsupportedActionIds,
	});
});
