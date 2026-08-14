import type { Effect } from "effect";

import type {
	PlannerGoalSearchBudget,
	PlannerGoalSearchDiagnostics,
	PlannerGoalSearchResult,
} from "~/editor/planner/PlannerGoalSearch";
import type {
	PlannerStrategy,
	PlannerStrategyRequest,
	PlannerStrategyResult,
} from "~/editor/planner/PlannerStrategy";

export type ConstructivePlannerStrategyResult = PlannerStrategyResult<
	"constructive",
	PlannerGoalSearchDiagnostics
>;

/** Constructive goal-stack search with branch-local snapshots and explicit backtracking. */
export interface ConstructivePlannerStrategy
	extends PlannerStrategy<"constructive", PlannerGoalSearchBudget, PlannerGoalSearchDiagnostics> {
	readonly searchFx: (
		request: PlannerStrategyRequest,
		budget?: Partial<PlannerGoalSearchBudget>,
	) => Effect.Effect<PlannerGoalSearchResult>;
}
