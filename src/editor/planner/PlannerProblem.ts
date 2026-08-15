import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** One independently solvable planning problem over an immutable candidate world. */
export interface PlannerProblem {
	readonly activeGoal: PlannerItemGoal;
	readonly agenda: ReadonlyArray<PlannerItemGoal>;
	readonly rootGoal: PlannerItemGoal;
	readonly runtime: RuntimeSchema.Type;
}

export interface PlannerSubgoalRequest {
	readonly activeGoal: PlannerItemGoal;
	readonly agenda?: ReadonlyArray<PlannerItemGoal>;
	readonly parent: PlannerProblem;
	readonly reason: string;
	readonly runtime: RuntimeSchema.Type;
}
