import { Effect } from "effect";

import type {
	ConstructivePlannerStrategy,
	ConstructivePlannerStrategyResult,
} from "~/editor/planner/ConstructivePlannerStrategy";
import {
	DefaultPlannerGoalSearchBudget,
	type PlannerGoalSearchBudget,
	type PlannerGoalSearchResult,
} from "~/editor/planner/PlannerGoalSearch";
import { PlannerKernelFx } from "~/editor/planner/PlannerKernelFx";
import { PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import { searchPlannerGoalFx } from "~/editor/planner/searchPlannerGoalFx";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";

const projectConstructiveResult = (
	result: PlannerGoalSearchResult,
): ConstructivePlannerStrategyResult => {
	const metrics = {
		expandedNodes: result.diagnostics.expandedBranches,
		frontierSize:
			result.type === "inconclusive"
				? result.frontierSize
				: result.diagnostics.maximumFrontierSize,
		traceLength:
			result.type === "completed"
				? result.execution.trace.length
				: result.type === "inconclusive"
					? result.bestExecution.trace.length
					: 0,
		visitedNodes: result.diagnostics.createdBranches,
	};
	switch (result.type) {
		case "completed":
			return {
				availableQuantity: result.availableQuantity,
				diagnostics: result.diagnostics,
				execution: result.execution,
				metrics,
				strategyId: PlannerStrategyId.constructive,
				type: "completed",
			};
		case "no-finite-path":
			return {
				diagnostics: result.diagnostics,
				metrics,
				proof: result.proof,
				strategyId: PlannerStrategyId.constructive,
				type: "no-finite-path",
			};
		case "inconclusive":
			return {
				bestAvailableQuantity: result.bestAvailableQuantity,
				blockedActionIds: result.blockedActionIds,
				...(result.budgetLimit === undefined
					? {}
					: {
							budgetLimit: result.budgetLimit,
						}),
				diagnostics: result.diagnostics,
				metrics,
				reason: result.reason,
				strategyId: PlannerStrategyId.constructive,
				type: "inconclusive",
				unsupportedActionIds: result.unsupportedActionIds,
			};
	}
};

/** Adapts constructive goal-stack search to the common strategy contract. */
export const createConstructivePlannerStrategy = ({
	budget: configuredBudget,
}: {
	readonly budget?: Partial<PlannerGoalSearchBudget>;
} = {}): ConstructivePlannerStrategy => ({
	id: PlannerStrategyId.constructive,
	solveFx: Effect.fn("ConstructivePlannerStrategy.solveFx")((problem) =>
		Effect.gen(function* () {
			const kernel = yield* PlannerKernelFx;
			return yield* searchPlannerGoalFx({
				budget: {
					...DefaultPlannerGoalSearchBudget,
					...configuredBudget,
				},
				graph: kernel.graph,
				itemId: problem.activeGoal.itemId,
				quantity: problem.activeGoal.quantity,
				runtime: problem.runtime,
			}).pipe(
				Effect.provideService(GameConfigFx, kernel.config),
				Effect.map(projectConstructiveResult),
			);
		}),
	),
});
