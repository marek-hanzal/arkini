import { Effect } from "effect";

import type {
	EditorPlannerStrategy,
	EditorPlannerStrategyAttemptDiagnostic,
	EditorPlannerStrategyDiagnostics,
	EditorPlannerStrategyMode,
	EditorPlannerStrategyPolicy,
	EditorPlannerStrategyProps,
	EditorPlannerStrategyResult,
} from "~/editor/planner/EditorPlannerStrategy";
import { DefaultPlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import { PlannerCurrentStrategyFx } from "~/editor/planner/PlannerCurrentStrategyFx";
import { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";
import { DefaultPlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { PlannerSessionFx } from "~/editor/planner/PlannerSessionFx";
import {
	PlannerStrategyId,
	type AnyPlannerStrategyResult,
	type PlannerStrategyMetrics,
} from "~/editor/planner/PlannerStrategy";
import { createBestFirstPlannerStrategy } from "~/editor/planner/createBestFirstPlannerStrategy";
import { createConstructivePlannerStrategy } from "~/editor/planner/createConstructivePlannerStrategy";
import {
	DefaultGoalDirectedBestFirstDepth,
	DefaultGoalDirectedConstructiveDelegationDepth,
	DefaultGoalDirectedConstructiveLinearRootDepth,
	DefaultGoalDirectedConstructiveMergeRootDepth,
	readGoalDirectedPlannerStrategySelection,
} from "~/editor/planner/createGoalDirectedPlannerStrategy";

export const DefaultEditorPlannerStrategyPolicy: EditorPlannerStrategyPolicy = {
	maximumBestFirstDepth: DefaultGoalDirectedBestFirstDepth,
	maximumConstructiveDelegationDepth: DefaultGoalDirectedConstructiveDelegationDepth,
	maximumConstructiveLinearRootDepth: DefaultGoalDirectedConstructiveLinearRootDepth,
	maximumConstructiveMergeRootDepth: DefaultGoalDirectedConstructiveMergeRootDepth,
};

export const DefaultEditorPlannerConstructiveBudget = {
	...DefaultPlannerGoalSearchBudget,
	maximumExpandedBranches: 32,
	maximumQueuedBranches: 32,
};

export const DefaultEditorPlannerBestFirstBudget = {
	...DefaultPlannerSearchBudget,
	maximumExpandedStates: 1_000,
	maximumQueuedStates: 16,
	maximumRoutePlans: 16,
	maximumTraceLength: 500,
};

const readAttempt = (
	result: AnyPlannerStrategyResult,
	index: number,
): EditorPlannerStrategyAttemptDiagnostic => ({
	diagnostics: result.diagnostics,
	index: index + 1,
	metrics: result.metrics,
	outcome: result.type,
	strategyId: result.strategyId,
});

const readCombinedMetrics = (
	attempts: ReadonlyArray<AnyPlannerStrategyResult>,
	selected: AnyPlannerStrategyResult,
): PlannerStrategyMetrics => ({
	expandedNodes: attempts.reduce((total, attempt) => total + attempt.metrics.expandedNodes, 0),
	frontierSize: attempts.reduce(
		(maximum, attempt) => Math.max(maximum, attempt.metrics.frontierSize),
		0,
	),
	traceLength: selected.metrics.traceLength,
	visitedNodes: attempts.reduce((total, attempt) => total + attempt.metrics.visitedNodes, 0),
});

const projectResult = ({
	attempts,
	mode,
	selected,
	selection,
}: {
	readonly attempts: ReadonlyArray<AnyPlannerStrategyResult>;
	readonly mode: EditorPlannerStrategyMode;
	readonly selected: AnyPlannerStrategyResult;
	readonly selection: EditorPlannerStrategyDiagnostics["selection"];
}): EditorPlannerStrategyResult => {
	const diagnostics: EditorPlannerStrategyDiagnostics = {
		attempts: attempts.map(readAttempt),
		mode,
		selectedAttemptIndex: attempts.indexOf(selected) + 1,
		selection,
	};
	const metrics = readCombinedMetrics(attempts, selected);
	switch (selected.type) {
		case "completed":
			return {
				availableQuantity: selected.availableQuantity,
				diagnostics,
				execution: selected.execution,
				metrics,
				strategyId: PlannerStrategyId.editor,
				type: "completed",
			};
		case "no-finite-path":
			return {
				diagnostics,
				metrics,
				proof: selected.proof,
				strategyId: PlannerStrategyId.editor,
				type: "no-finite-path",
			};
		case "inconclusive":
			return {
				bestAvailableQuantity: selected.bestAvailableQuantity,
				blockedActionIds: selected.blockedActionIds,
				...(selected.budgetLimit === undefined
					? {}
					: {
							budgetLimit: selected.budgetLimit,
						}),
				diagnostics,
				metrics,
				reason: selected.reason,
				strategyId: PlannerStrategyId.editor,
				type: "inconclusive",
				unsupportedActionIds: selected.unsupportedActionIds,
			};
	}
};

/**
 * Production editor strategy.
 *
 * The shared goal-directed selector admits constructive search only for compact deterministic
 * roots and descending subgoals. Any inconclusive constructive attempt is retried through the
 * established bounded best-first search over the original immutable snapshot.
 */
export const createEditorPlannerStrategy = ({
	bestFirstBudget,
	constructiveBudget,
	policy: policyInput,
}: EditorPlannerStrategyProps = {}): EditorPlannerStrategy => {
	const policy: EditorPlannerStrategyPolicy = {
		...DefaultEditorPlannerStrategyPolicy,
		...policyInput,
	};
	const constructive = createConstructivePlannerStrategy({
		budget: {
			...DefaultEditorPlannerConstructiveBudget,
			...constructiveBudget,
		},
	});
	const bestFirst = createBestFirstPlannerStrategy({
		budget: {
			...DefaultEditorPlannerBestFirstBudget,
			...bestFirstBudget,
		},
	});
	return {
		id: PlannerStrategyId.editor,
		solveFx: Effect.fn("EditorPlannerStrategy.solveFx")((problem) =>
			Effect.gen(function* () {
				const currentStrategy = yield* PlannerCurrentStrategyFx;
				const kernel = yield* PlannerKernelFx;
				const session = yield* PlannerSessionFx;
				const selection = readGoalDirectedPlannerStrategySelection({
					currentStrategy,
					graph: kernel.graph,
					...policy,
					problem,
				});
				let selected: AnyPlannerStrategyResult;
				if (selection.strategyId === PlannerStrategyId.constructive)
					selected = yield* session.runStrategyFx({
						problem,
						reason: selection.reason,
						strategy: constructive,
					});
				else
					selected = yield* session.runStrategyFx({
						problem,
						reason: selection.reason,
						strategy: bestFirst,
					});
				if (
					selection.strategyId !== PlannerStrategyId.constructive ||
					selected.type !== "inconclusive"
				)
					return projectResult({
						attempts: [
							selected,
						],
						mode:
							selection.strategyId === PlannerStrategyId.constructive
								? "selected-constructive"
								: "selected-best-first",
						selected,
						selection,
					});

				const fallback = yield* session.runStrategyFx({
					problem,
					reason: "fallback-after-constructive-inconclusive",
					strategy: bestFirst,
				});
				return projectResult({
					attempts: [
						selected,
						fallback,
					],
					mode: "constructive-fallback-best-first",
					selected: fallback,
					selection,
				});
			}),
		),
	};
};
