import { Effect } from "effect";

import type {
	AdaptivePlannerStrategy,
	AdaptivePlannerStrategySelection,
	AdaptivePlannerStrategySituation,
} from "~/editor/planner/AdaptivePlannerStrategy";
import type { PlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { createAdaptivePlannerStrategy } from "~/editor/planner/createAdaptivePlannerStrategy";
import { createBestFirstPlannerStrategy } from "~/editor/planner/createBestFirstPlannerStrategy";
import { createConstructivePlannerStrategy } from "~/editor/planner/createConstructivePlannerStrategy";

export const DefaultGoalDirectedBestFirstDepth = 6;
export const DefaultGoalDirectedConstructiveDelegationDepth = 1;
export const DefaultGoalDirectedConstructiveRootDepth = 5;

export namespace createGoalDirectedPlannerStrategy {
	export interface Props {
		readonly constructiveBudget?: Partial<PlannerGoalSearchBudget>;
		readonly delegatedBestFirstBudget?: Partial<PlannerSearchBudget>;
		/** Maximum optimistic graph depth delegated as one local best-first subproblem. */
		readonly maximumBestFirstDepth?: number;
		/** Deep subgoals may be decomposed constructively only this many session levels below root. */
		readonly maximumConstructiveDelegationDepth?: number;
		/** Root goals deeper than this optimistic graph depth go directly to best-first search. */
		readonly maximumConstructiveRootDepth?: number;
	}
}

const readAdaptiveDelegationDepth = (
	currentStrategy: AdaptivePlannerStrategySituation["currentStrategy"],
) =>
	Math.max(
		0,
		currentStrategy.path.filter((strategyId) => strategyId === PlannerStrategyId.adaptive)
			.length - 1,
	);

export const readGoalDirectedPlannerStrategySelection = ({
	currentStrategy,
	graph,
	maximumBestFirstDepth,
	maximumConstructiveDelegationDepth,
	maximumConstructiveRootDepth,
	problem,
}: Pick<AdaptivePlannerStrategySituation, "currentStrategy" | "graph" | "problem"> & {
	readonly maximumBestFirstDepth: number;
	readonly maximumConstructiveDelegationDepth: number;
	readonly maximumConstructiveRootDepth: number;
}): AdaptivePlannerStrategySelection => {
	const delegationDepth = readAdaptiveDelegationDepth(currentStrategy);
	const depth = graph.depthByItemId.get(problem.activeGoal.itemId);
	const routes = graph.routesByOutputItemId.get(problem.activeGoal.itemId) ?? [];
	if (routes.some(({ output }) => output.stochastic))
		return {
			reason: "solve-stochastic-goal",
			strategyId: PlannerStrategyId.bestFirst,
		};
	if (delegationDepth === 0)
		return depth !== undefined && depth > maximumConstructiveRootDepth
			? {
					reason: `solve-deep-root-goal:depth-${depth}`,
					strategyId: PlannerStrategyId.bestFirst,
				}
			: {
					reason: "construct-root-goal",
					strategyId: PlannerStrategyId.constructive,
				};
	if (depth === undefined)
		return {
			reason: "solve-local-resource-goal:unknown-depth",
			strategyId: PlannerStrategyId.bestFirst,
		};
	if (depth <= maximumBestFirstDepth)
		return {
			reason: `solve-local-resource-goal:depth-${depth}`,
			strategyId: PlannerStrategyId.bestFirst,
		};
	if (delegationDepth > maximumConstructiveDelegationDepth)
		return {
			reason: `solve-bounded-resource-goal:delegation-depth-${delegationDepth}`,
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

/**
 * Composes recursive constructive decomposition with local best-first subgoal solving.
 *
 * Deep authored goals remain constructive so that one local frontier does not swallow an entire
 * era. Short or stochastic subproblems are delegated to runtime search over their exact snapshot.
 */
export const createGoalDirectedPlannerStrategy = ({
	constructiveBudget,
	delegatedBestFirstBudget,
	maximumBestFirstDepth = DefaultGoalDirectedBestFirstDepth,
	maximumConstructiveDelegationDepth = DefaultGoalDirectedConstructiveDelegationDepth,
	maximumConstructiveRootDepth = DefaultGoalDirectedConstructiveRootDepth,
}: createGoalDirectedPlannerStrategy.Props = {}): AdaptivePlannerStrategy => {
	if (!Number.isSafeInteger(maximumBestFirstDepth) || maximumBestFirstDepth < 0)
		throw new RangeError("Goal-directed best-first depth must be a non-negative safe integer.");
	if (
		!Number.isSafeInteger(maximumConstructiveDelegationDepth) ||
		maximumConstructiveDelegationDepth < 0
	)
		throw new RangeError(
			"Goal-directed constructive delegation depth must be a non-negative safe integer.",
		);
	if (!Number.isSafeInteger(maximumConstructiveRootDepth) || maximumConstructiveRootDepth < 0)
		throw new RangeError(
			"Goal-directed constructive root depth must be a non-negative safe integer.",
		);
	return createAdaptivePlannerStrategy({
		selectFx: (situation) =>
			Effect.succeed(
				readGoalDirectedPlannerStrategySelection({
					currentStrategy: situation.currentStrategy,
					graph: situation.graph,
					maximumBestFirstDepth,
					maximumConstructiveDelegationDepth,
					maximumConstructiveRootDepth,
					problem: situation.problem,
				}),
			),
		strategies: [
			createConstructivePlannerStrategy({
				budget: constructiveBudget,
			}),
			createBestFirstPlannerStrategy({
				budget: delegatedBestFirstBudget,
			}),
		],
	});
};
