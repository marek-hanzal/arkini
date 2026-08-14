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
export const DefaultGoalDirectedConstructiveLinearRootDepth = 1;
export const DefaultGoalDirectedConstructiveRootDepth = 8;

export namespace createGoalDirectedPlannerStrategy {
	export interface Props {
		readonly constructiveBudget?: Partial<PlannerGoalSearchBudget>;
		readonly delegatedBestFirstBudget?: Partial<PlannerSearchBudget>;
		/** Maximum optimistic graph depth delegated as one local best-first subproblem. */
		readonly maximumBestFirstDepth?: number;
		/** Constructive decomposition may recursively own only this many nested subgoals. */
		readonly maximumConstructiveDelegationDepth?: number;
		/** Single-route line goals no deeper than this may use constructive execution at root. */
		readonly maximumConstructiveLinearRootDepth?: number;
		/** Merge roots deeper than this optimistic graph depth go directly to best-first search. */
		readonly maximumConstructiveRootDepth?: number;
	}
}

const readConstructiveDelegationDepth = (
	currentStrategy: AdaptivePlannerStrategySituation["currentStrategy"],
) =>
	currentStrategy.path.filter((strategyId) => strategyId === PlannerStrategyId.constructive)
		.length;

/** Pure, deterministic routing policy for the first editor-facing adaptive strategy. */
export const readGoalDirectedPlannerStrategySelection = ({
	currentStrategy,
	graph,
	maximumBestFirstDepth,
	maximumConstructiveDelegationDepth,
	maximumConstructiveLinearRootDepth,
	maximumConstructiveRootDepth,
	problem,
}: Pick<AdaptivePlannerStrategySituation, "currentStrategy" | "graph" | "problem"> & {
	readonly maximumBestFirstDepth: number;
	readonly maximumConstructiveDelegationDepth: number;
	readonly maximumConstructiveLinearRootDepth: number;
	readonly maximumConstructiveRootDepth: number;
}): AdaptivePlannerStrategySelection => {
	const depth = graph.depthByItemId.get(problem.activeGoal.itemId);
	const routes = graph.routesByOutputItemId.get(problem.activeGoal.itemId) ?? [];
	if (routes.some(({ output }) => output.stochastic))
		return {
			reason: "solve-stochastic-goal",
			strategyId: PlannerStrategyId.bestFirst,
		};

	const constructiveDelegationDepth = readConstructiveDelegationDepth(currentStrategy);
	if (currentStrategy.depth === 0) {
		const route = routes.length === 1 ? routes[0] : undefined;
		if (
			route?.kind === "merge-output" &&
			depth !== undefined &&
			depth <= maximumConstructiveRootDepth
		)
			return {
				reason: `construct-merge-root-goal:depth-${depth}`,
				strategyId: PlannerStrategyId.constructive,
			};
		if (
			route?.kind === "line-output" &&
			depth !== undefined &&
			depth <= maximumConstructiveLinearRootDepth &&
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
	if (depth <= maximumBestFirstDepth)
		return {
			reason: `solve-local-resource-goal:depth-${depth}`,
			strategyId: PlannerStrategyId.bestFirst,
		};
	if (constructiveDelegationDepth > maximumConstructiveDelegationDepth)
		return {
			reason: `solve-bounded-resource-goal:delegation-depth-${constructiveDelegationDepth}`,
			strategyId: PlannerStrategyId.bestFirst,
		};
	const parentGoal = problem.agenda.find(
		(goal, index) => index > 0 && goal.itemId !== problem.activeGoal.itemId,
	);
	const parentDepth =
		parentGoal === undefined ? undefined : graph.depthByItemId.get(parentGoal.itemId);
	return parentDepth !== undefined && depth >= parentDepth
		? {
				reason: `solve-non-descending-resource-goal:depth-${depth}-from-${parentDepth}`,
				strategyId: PlannerStrategyId.bestFirst,
			}
		: {
				reason: `decompose-resource-goal:depth-${depth}`,
				strategyId: PlannerStrategyId.constructive,
			};
};

/**
 * Composes constructive decomposition with local best-first subgoal solving.
 *
 * The editor-facing selector is deliberately conservative at the root. Constructive search owns
 * compact deterministic line goals and merge goals where snapshot backtracking is useful. Branchy,
 * stochastic, or broad authored roots stay in the established bounded best-first search. Once a
 * constructive branch delegates a real subgoal, the selector may decompose it further only while
 * graph depth descends and the shared session remains shallow.
 */
export const createGoalDirectedPlannerStrategy = ({
	constructiveBudget,
	delegatedBestFirstBudget,
	maximumBestFirstDepth = DefaultGoalDirectedBestFirstDepth,
	maximumConstructiveDelegationDepth = DefaultGoalDirectedConstructiveDelegationDepth,
	maximumConstructiveLinearRootDepth = DefaultGoalDirectedConstructiveLinearRootDepth,
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
	if (
		!Number.isSafeInteger(maximumConstructiveLinearRootDepth) ||
		maximumConstructiveLinearRootDepth < 0
	)
		throw new RangeError(
			"Goal-directed constructive linear root depth must be a non-negative safe integer.",
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
					maximumConstructiveLinearRootDepth,
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
