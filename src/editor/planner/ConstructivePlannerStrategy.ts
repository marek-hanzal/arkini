import type { PlannerGoalSearchDiagnostics } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerStrategy, PlannerStrategyResult } from "~/editor/planner/PlannerStrategy";

export type ConstructivePlannerStrategyResult = PlannerStrategyResult<
	"constructive",
	PlannerGoalSearchDiagnostics
>;

/** Constructive goal-stack search with branch-local snapshots and explicit backtracking. */
export interface ConstructivePlannerStrategy
	extends PlannerStrategy<"constructive", PlannerGoalSearchDiagnostics> {
	//
}
