import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
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

const compareIds = (left: string, right: string) => left.localeCompare(right);

/** Keeps one active-first agenda with the strongest demand for every canonical item. */
export const mergePlannerGoalAgenda = ({
	activeGoal,
	goals,
}: {
	readonly activeGoal: PlannerItemGoal;
	readonly goals: ReadonlyArray<PlannerItemGoal>;
}): ReadonlyArray<PlannerItemGoal> => {
	const demandByItemId = new Map<
		IdSchema.Type,
		{
			minimumCharges: number;
			quantity: number;
		}
	>();
	for (const goal of [
		activeGoal,
		...goals,
	]) {
		const current = demandByItemId.get(goal.itemId);
		demandByItemId.set(goal.itemId, {
			minimumCharges: Math.max(current?.minimumCharges ?? 0, goal.minimumCharges ?? 0),
			quantity: Math.max(current?.quantity ?? 0, goal.quantity),
		});
	}
	const activeDemand = demandByItemId.get(activeGoal.itemId);
	if (activeDemand === undefined)
		throw new Error(`Planner agenda lost active goal ${activeGoal.itemId}.`);
	return [
		{
			itemId: activeGoal.itemId,
			minimumCharges: activeDemand.minimumCharges,
			quantity: activeDemand.quantity,
		},
		...[
			...demandByItemId,
		]
			.filter(([itemId]) => itemId !== activeGoal.itemId)
			.sort(([left], [right]) => compareIds(left, right))
			.map(([itemId, demand]) => ({
				itemId,
				minimumCharges: demand.minimumCharges,
				quantity: demand.quantity,
			})),
	];
};

export const createRootPlannerProblem = ({
	goal,
	runtime,
}: {
	readonly goal: PlannerItemGoal;
	readonly runtime: RuntimeSchema.Type;
}): PlannerProblem => {
	const agenda = mergePlannerGoalAgenda({
		activeGoal: goal,
		goals: [],
	});
	const activeGoal = agenda[0];
	if (activeGoal === undefined) throw new Error("Planner root agenda is empty.");
	return {
		activeGoal,
		agenda,
		rootGoal: activeGoal,
		runtime,
	};
};

export const createPlannerSubproblem = ({
	activeGoal: requestedActiveGoal,
	agenda: requestedAgenda,
	parent,
	runtime,
}: Omit<PlannerSubgoalRequest, "reason">): PlannerProblem => {
	const agenda = mergePlannerGoalAgenda({
		activeGoal: requestedActiveGoal,
		goals: [
			...(requestedAgenda ?? []),
			...parent.agenda,
		],
	});
	const activeGoal = agenda[0];
	if (activeGoal === undefined) throw new Error("Planner subgoal agenda is empty.");
	return {
		activeGoal,
		agenda,
		rootGoal: parent.rootGoal,
		runtime,
	};
};
