import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** One independently solvable planning problem over an immutable candidate world. */
export interface PlannerProblem {
	readonly activeGoal: PlannerItemGoal;
	readonly agenda: ReadonlyArray<PlannerItemGoal>;
	readonly delegationDepth: number;
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

export const createRootPlannerProblem = ({
	goal,
	runtime,
}: {
	readonly goal: PlannerItemGoal;
	readonly runtime: RuntimeSchema.Type;
}): PlannerProblem => ({
	activeGoal: goal,
	agenda: [
		goal,
	],
	delegationDepth: 0,
	rootGoal: goal,
	runtime,
});

export const createPlannerSubproblem = ({
	activeGoal,
	agenda,
	parent,
	runtime,
}: Omit<PlannerSubgoalRequest, "reason">): PlannerProblem => ({
	activeGoal,
	agenda: agenda ?? [
		activeGoal,
		...parent.agenda,
	],
	delegationDepth: parent.delegationDepth + 1,
	rootGoal: parent.rootGoal,
	runtime,
});
