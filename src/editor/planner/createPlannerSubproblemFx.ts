import { Effect } from "effect";

import type { PlannerProblem, PlannerSubgoalRequest } from "~/editor/planner/PlannerProblem";
import { mergePlannerGoalAgendaFx } from "~/editor/planner/mergePlannerGoalAgendaFx";

export const createPlannerSubproblemFx = Effect.fn("createPlannerSubproblemFx")(
	({
		activeGoal: requestedActiveGoal,
		agenda: requestedAgenda,
		parent,
		runtime,
	}: Omit<PlannerSubgoalRequest, "reason">) =>
		Effect.gen(function* () {
			const agenda = yield* mergePlannerGoalAgendaFx({
				activeGoal: requestedActiveGoal,
				goals: [
					...(requestedAgenda ?? []),
					...parent.agenda,
				],
			});
			const activeGoal = agenda[0];
			if (activeGoal === undefined)
				return yield* Effect.die("Planner subgoal agenda is empty.");
			return {
				activeGoal,
				agenda,
				rootGoal: parent.rootGoal,
				runtime,
			} satisfies PlannerProblem;
		}),
);
