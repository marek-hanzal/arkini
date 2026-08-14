import type { PlannerSearchDiagnostics } from "~/editor/planner/PlannerSearch";
import type { PlannerStrategy, PlannerStrategyResult } from "~/editor/planner/PlannerStrategy";

export type BestFirstPlannerStrategyResult = PlannerStrategyResult<
	"best-first",
	PlannerSearchDiagnostics
>;

/** Established global best-first runtime search behind the common strategy contract. */
export interface BestFirstPlannerStrategy
	extends PlannerStrategy<"best-first", PlannerSearchDiagnostics> {
	//
}
