import type { BestFirstPlannerStrategyResult } from "~/editor/planner/BestFirstPlannerStrategy";
import type { ConstructivePlannerStrategyResult } from "~/editor/planner/ConstructivePlannerStrategy";
import type { PlannerExpectedEconomics } from "~/editor/planner/PlannerExpectedEconomics";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerNoFinitePathProof, PlannerStrategyId } from "~/editor/planner/PlannerStrategy";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

export type AnyPlannerStrategyResult =
	| BestFirstPlannerStrategyResult
	| ConstructivePlannerStrategyResult;

export interface PlannerStrategyAttempt {
	readonly index: number;
	readonly result: AnyPlannerStrategyResult;
}

interface PlannerResultBase {
	readonly attempts: ReadonlyArray<PlannerStrategyAttempt>;
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
}

export type PlannerResult =
	| (PlannerResultBase & {
			readonly availableQuantity: number;
			readonly economics: PlannerExpectedEconomics;
			readonly execution: PlannerSearchExecutionState;
			readonly type: "completed";
			readonly winningAttemptIndex: number;
			readonly winningStrategyId: PlannerStrategyId;
	  })
	| (PlannerResultBase & {
			readonly proof: PlannerNoFinitePathProof;
			readonly provingAttemptIndex: number;
			readonly provingStrategyId: PlannerStrategyId;
			readonly type: "no-finite-path";
	  })
	| (PlannerResultBase & {
			readonly bestAvailableQuantity: number;
			readonly type: "inconclusive";
	  });
