import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerGoalViability, PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import { readPlannerGoalViability } from "~/editor/planner/readPlannerGoalViability";
import { readPlannerItemGoalMinimumCharges } from "~/editor/planner/readPlannerItemGoalStatus";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const normalizeGoals = (goals: ReadonlyArray<PlannerItemGoal>) => {
	const demandByItemId = new Map<
		IdSchema.Type,
		{
			readonly minimumCharges: number;
			readonly quantity: number;
		}
	>();
	for (const goal of goals) {
		const current = demandByItemId.get(goal.itemId);
		demandByItemId.set(goal.itemId, {
			minimumCharges: Math.max(
				current?.minimumCharges ?? 0,
				readPlannerItemGoalMinimumCharges(goal),
			),
			quantity: Math.max(current?.quantity ?? 0, goal.quantity),
		});
	}
	return [
		...demandByItemId,
	]
		.sort(([left], [right]) => compareIds(left, right))
		.map(([itemId, demand]) => ({
			itemId,
			minimumCharges: demand.minimumCharges,
			quantity: demand.quantity,
		}));
};

/**
 * Checks every still-required resource against one exact speculative runtime snapshot.
 *
 * A dead goal is a sound reason to discard the current branch. A viable result remains
 * deliberately optimistic; the canonical engine must still validate quantities, charges and order.
 */
export const readPlannerGoalAgendaViability = ({
	goals,
	graph,
	runtime,
}: {
	readonly goals: ReadonlyArray<PlannerItemGoal>;
	readonly graph: PlannerAcquisitionGraph;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const viabilities = normalizeGoals(goals).map((goal) =>
		readPlannerGoalViability({
			goal,
			graph,
			runtime,
		}),
	);
	const deadEnd = viabilities.find(
		(
			viability,
		): viability is Extract<
			PlannerGoalViability,
			{
				readonly type: "dead-end";
			}
		> => viability.type === "dead-end",
	);
	return deadEnd === undefined
		? {
				type: "viable" as const,
				viabilities,
			}
		: {
				type: "dead-end" as const,
				viability: deadEnd,
			};
};
