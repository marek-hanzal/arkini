import { Effect } from "effect";

import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

/** Keeps one active-first agenda with the strongest demand for every canonical item. */
export const mergePlannerGoalAgendaFx = Effect.fn("mergePlannerGoalAgendaFx")(
	({
		activeGoal,
		goals,
	}: {
		readonly activeGoal: PlannerItemGoal;
		readonly goals: ReadonlyArray<PlannerItemGoal>;
	}) =>
		Effect.sync((): ReadonlyArray<PlannerItemGoal> => {
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
					minimumCharges: Math.max(
						current?.minimumCharges ?? 0,
						goal.minimumCharges ?? 0,
					),
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
		}),
);
