import type { PlannerStructuralReachability } from "~/editor/planner/PlannerStructuralReachability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

export interface PlannerItemGoal {
	readonly itemId: IdSchema.Type;
	readonly minimumCharges?: number;
	readonly quantity: number;
}

/** Structural viability of one item goal from one exact immutable runtime snapshot. */
export type PlannerGoalViability =
	| {
			readonly availableCharges: number;
			readonly availableQuantity: number;
			readonly goal: PlannerItemGoal;
			readonly type: "satisfied";
	  }
	| {
			readonly availableCharges: number;
			readonly availableQuantity: number;
			readonly goal: PlannerItemGoal;
			readonly reachability: Extract<
				PlannerStructuralReachability,
				{
					readonly type: "reachable";
				}
			>;
			readonly type: "reachable";
	  }
	| {
			readonly availableCharges: number;
			readonly availableQuantity: number;
			readonly goal: PlannerItemGoal;
			readonly proof: Exclude<
				PlannerStructuralReachability,
				{
					readonly type: "reachable";
				}
			>;
			readonly type: "dead-end";
	  };
