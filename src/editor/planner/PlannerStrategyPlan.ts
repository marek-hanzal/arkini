import type { PlannerGoalSearchBudget } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";

export type PlannerStrategyPlanEntry =
	| {
			readonly budget?: Partial<PlannerSearchBudget>;
			readonly strategyId: "best-first";
	  }
	| {
			readonly budget?: Partial<PlannerGoalSearchBudget>;
			readonly strategyId: "constructive";
	  };

/** Production-compatible default until the constructive strategy has broader coverage. */
export const DefaultPlannerStrategyPlan: ReadonlyArray<PlannerStrategyPlanEntry> = [
	{
		strategyId: "best-first",
	},
];
