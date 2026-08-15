import { Effect } from "effect";

import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerProblem } from "~/editor/planner/PlannerProblem";
import { mergePlannerGoalAgendaFx } from "~/editor/planner/mergePlannerGoalAgendaFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export const createRootPlannerProblemFx = Effect.fn("createRootPlannerProblemFx")(
	({ goal, runtime }: { readonly goal: PlannerItemGoal; readonly runtime: RuntimeSchema.Type }) =>
		Effect.gen(function* () {
			const agenda = yield* mergePlannerGoalAgendaFx({
				activeGoal: goal,
				goals: [],
			});
			const activeGoal = agenda[0];
			if (activeGoal === undefined) return yield* Effect.die("Planner root agenda is empty.");
			return {
				activeGoal,
				agenda,
				rootGoal: activeGoal,
				runtime,
			} satisfies PlannerProblem;
		}),
);
