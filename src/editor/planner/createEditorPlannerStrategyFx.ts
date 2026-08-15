import { Effect } from "effect";

import type {
	EditorPlannerStrategy,
	EditorPlannerStrategyAttemptDiagnostic,
	EditorPlannerStrategyDiagnostics,
	EditorPlannerStrategyMode,
	EditorPlannerStrategyPolicy,
	EditorPlannerStrategyProps,
	EditorPlannerStrategyResult,
	EditorPlannerStrategySelection,
} from "~/editor/planner/EditorPlannerStrategy";
import { DefaultPlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import { DefaultPlannerProducerExpansionBudget } from "~/editor/planner/PlannerProducerExpansion";
import type { PlannerProblem } from "~/editor/planner/PlannerProblem";
import {
	PlannerCurrentStrategyFx,
	type PlannerCurrentStrategyFxService,
} from "~/editor/planner/PlannerCurrentStrategyFx";
import { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";
import { DefaultPlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { PlannerSessionFx } from "~/editor/planner/PlannerSessionFx";
import {
	PlannerStrategyId,
	type AnyPlannerStrategyResult,
	type PlannerStrategyMetrics,
} from "~/editor/planner/PlannerStrategy";
import { createBestFirstPlannerStrategyFx } from "~/editor/planner/createBestFirstPlannerStrategyFx";
import { createConstructivePlannerStrategyFx } from "~/editor/planner/createConstructivePlannerStrategyFx";
import { createProducerExpansionPlannerStrategyFx } from "~/editor/planner/createProducerExpansionPlannerStrategyFx";

export const DefaultEditorPlannerStrategyPolicy: EditorPlannerStrategyPolicy = {
	maximumBestFirstDepth: 6,
	maximumProducerExpansionDepth: 12,
	maximumConstructiveDelegationDepth: 1,
	maximumConstructiveLinearRootDepth: 1,
	maximumConstructiveMergeRootDepth: 8,
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

export const DefaultEditorPlannerProducerExpansionBudget = {
	...DefaultPlannerProducerExpansionBudget,
	maximumExpandedActions: 1_024,
	maximumTraceLength: 500,
};

const readConstructiveDelegationDepth = (path: ReadonlyArray<string>) =>
	path.filter((strategyId) => strategyId === PlannerStrategyId.constructive).length;

const readStrategySelection = ({
	currentStrategy,
	graph,
	policy,
	problem,
}: {
	readonly currentStrategy: PlannerCurrentStrategyFxService;
	readonly graph: PlannerAcquisitionGraph;
	readonly policy: EditorPlannerStrategyPolicy;
	readonly problem: PlannerProblem;
}): EditorPlannerStrategySelection => {
	const depth = graph.depthByItemId.get(problem.activeGoal.itemId);
	const routes = graph.routesByOutputItemId.get(problem.activeGoal.itemId) ?? [];
	if ((problem.activeGoal.minimumCharges ?? 0) > 0)
		return {
			reason: "construct-charge-goal",
			strategyId: PlannerStrategyId.constructive,
		};
	if (routes.some(({ output }) => output.stochastic))
		return {
			reason: "solve-stochastic-goal",
			strategyId: PlannerStrategyId.bestFirst,
		};

	const constructiveDelegationDepth = readConstructiveDelegationDepth(currentStrategy.path);
	if (currentStrategy.depth === 0) {
		const route = routes.length === 1 ? routes[0] : undefined;
		if (
			route?.kind === "merge-output" &&
			depth !== undefined &&
			depth <= policy.maximumConstructiveMergeRootDepth
		)
			return {
				reason: `construct-merge-root-goal:depth-${depth}`,
				strategyId: PlannerStrategyId.constructive,
			};
		if (
			route?.kind === "line-output" &&
			depth !== undefined &&
			depth <= policy.maximumConstructiveLinearRootDepth &&
			route.requirements.anyOf.length === 0 &&
			route.requirements.allOf.length <= 3
		)
			return {
				reason: `construct-linear-root-goal:depth-${depth}`,
				strategyId: PlannerStrategyId.constructive,
			};
		return {
			reason:
				depth === undefined
					? "solve-root-goal:unknown-depth"
					: `solve-root-goal:depth-${depth}`,
			strategyId: PlannerStrategyId.bestFirst,
		};
	}
	if (depth === undefined)
		return {
			reason: "solve-local-resource-goal:unknown-depth",
			strategyId: PlannerStrategyId.bestFirst,
		};
	if (depth <= policy.maximumBestFirstDepth)
		return {
			reason: `solve-local-resource-goal:depth-${depth}`,
			strategyId: PlannerStrategyId.bestFirst,
		};
	if (constructiveDelegationDepth > policy.maximumConstructiveDelegationDepth)
		return {
			reason: `solve-bounded-resource-goal:delegation-depth-${constructiveDelegationDepth}`,
			strategyId: PlannerStrategyId.bestFirst,
		};
	const rootDepth = graph.depthByItemId.get(problem.rootGoal.itemId);
	return rootDepth !== undefined && depth >= rootDepth
		? {
				reason: `solve-non-descending-resource-goal:depth-${depth}-from-${rootDepth}`,
				strategyId: PlannerStrategyId.bestFirst,
			}
		: {
				reason: `decompose-resource-goal:depth-${depth}`,
				strategyId: PlannerStrategyId.constructive,
			};
};

const validatePolicy = (policy: EditorPlannerStrategyPolicy) => {
	for (const [name, value] of Object.entries(policy))
		if (!Number.isSafeInteger(value) || value < 0)
			throw new RangeError(`${name} must be a non-negative safe integer.`);
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
export const createEditorPlannerStrategyFx = Effect.fn("createEditorPlannerStrategyFx")(
	({
		bestFirstBudget,
		constructiveBudget,
		policy: policyInput,
		producerExpansionBudget,
	}: EditorPlannerStrategyProps = {}) =>
		Effect.gen(function* () {
			const policy: EditorPlannerStrategyPolicy = {
				...DefaultEditorPlannerStrategyPolicy,
				...policyInput,
			};
			validatePolicy(policy);
			const constructive = yield* createConstructivePlannerStrategyFx({
				budget: {
					...DefaultEditorPlannerConstructiveBudget,
					...constructiveBudget,
				},
			});
			const bestFirst = yield* createBestFirstPlannerStrategyFx({
				budget: {
					...DefaultEditorPlannerBestFirstBudget,
					...bestFirstBudget,
				},
			});
			const producerExpansion = yield* createProducerExpansionPlannerStrategyFx({
				budget: {
					...DefaultEditorPlannerProducerExpansionBudget,
					...producerExpansionBudget,
				},
			});
			return {
				id: PlannerStrategyId.editor,
				solveFx: Effect.fn("EditorPlannerStrategy.solveFx")((problem) =>
					Effect.gen(function* () {
						const currentStrategy = yield* PlannerCurrentStrategyFx;
						const kernel = yield* PlannerKernelFx;
						const session = yield* PlannerSessionFx;
						const attempts: AnyPlannerStrategyResult[] = [];
						const targetDepth =
							kernel.graph.depthByItemId.get(problem.activeGoal.itemId) ??
							Number.POSITIVE_INFINITY;
						const producerExpansionEligible =
							targetDepth <= policy.maximumProducerExpansionDepth;

						if (producerExpansionEligible) {
							const expansion = yield* session.runStrategyFx({
								problem,
								reason: `expand-current-producer-world:depth-${targetDepth}`,
								strategy: producerExpansion,
							});
							attempts.push(expansion);
							if (expansion.type !== "inconclusive")
								return projectResult({
									attempts,
									mode: "selected-producer-expansion",
									selected: expansion,
									selection: null,
								});
						}

						const selection = readStrategySelection({
							currentStrategy,
							graph: kernel.graph,
							policy,
							problem,
						});
						let selected: AnyPlannerStrategyResult;
						if (selection.strategyId === PlannerStrategyId.constructive)
							selected = yield* session.runStrategyFx({
								problem,
								reason: producerExpansionEligible
									? `fallback-after-producer-expansion:${selection.reason}`
									: selection.reason,
								strategy: constructive,
							});
						else
							selected = yield* session.runStrategyFx({
								problem,
								reason: producerExpansionEligible
									? `fallback-after-producer-expansion:${selection.reason}`
									: selection.reason,
								strategy: bestFirst,
							});
						attempts.push(selected);
						if (
							selection.strategyId !== PlannerStrategyId.constructive ||
							selected.type !== "inconclusive"
						)
							return projectResult({
								attempts,
								mode: producerExpansionEligible
									? selection.strategyId === PlannerStrategyId.constructive
										? "producer-expansion-fallback-constructive"
										: "producer-expansion-fallback-best-first"
									: selection.strategyId === PlannerStrategyId.constructive
										? "selected-constructive"
										: "selected-best-first",
								selected,
								selection,
							});

						const bestFirstFallback = yield* session.runStrategyFx({
							problem,
							reason: "fallback-after-constructive-inconclusive",
							strategy: bestFirst,
						});
						attempts.push(bestFirstFallback);
						return projectResult({
							attempts,
							mode: producerExpansionEligible
								? "producer-expansion-fallback-constructive-fallback-best-first"
								: "constructive-fallback-best-first",
							selected: bestFirstFallback,
							selection,
						});
					}),
				),
			} satisfies EditorPlannerStrategy;
		}),
);
