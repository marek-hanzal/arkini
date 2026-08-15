import type { PlannerProducerExpansionDiagnostics } from "~/editor/planner/PlannerProducerExpansion";
import type { PlannerStrategy, PlannerStrategyResult } from "~/editor/planner/PlannerStrategy";
import type { PlannerStrategyEnvironment } from "~/editor/planner/PlannerStrategyEnvironment";

export type ProducerExpansionPlannerStrategyResult = PlannerStrategyResult<
	"producer-expansion",
	PlannerProducerExpansionDiagnostics
>;

/** Demand-guided forward expansion through currently available producer capabilities. */
export interface ProducerExpansionPlannerStrategy
	extends PlannerStrategy<
		"producer-expansion",
		PlannerProducerExpansionDiagnostics,
		PlannerStrategyEnvironment
	> {
	//
}
