import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import { readPlannerRuntimeChargeCapacity } from "~/editor/planner/readPlannerRuntimeChargeCapacity";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerItemGoalStatus {
	readonly availableCharges: number;
	readonly availableQuantity: number;
	readonly minimumCharges: number;
	readonly satisfied: boolean;
}

export const readPlannerItemGoalMinimumCharges = (goal: PlannerItemGoal) =>
	goal.minimumCharges ?? 0;

/** Reads the exact quantity and charge state of one item goal in one immutable runtime. */
export const readPlannerItemGoalStatus = (
	goal: PlannerItemGoal,
	runtime: RuntimeSchema.Type,
): PlannerItemGoalStatus => {
	const minimumCharges = readPlannerItemGoalMinimumCharges(goal);
	if (!Number.isSafeInteger(goal.quantity) || goal.quantity < 1)
		throw new RangeError(
			`Planner goal quantity must be a positive safe integer, received ${goal.quantity}.`,
		);
	if (!Number.isSafeInteger(minimumCharges) || minimumCharges < 0)
		throw new RangeError(
			`Planner goal minimum charges must be a non-negative safe integer, received ${minimumCharges}.`,
		);
	const availableQuantity = readPlannerRuntimeQuantity(runtime, goal.itemId);
	const availableCharges = readPlannerRuntimeChargeCapacity(runtime, goal.itemId);
	return {
		availableCharges,
		availableQuantity,
		minimumCharges,
		satisfied: availableQuantity >= goal.quantity && availableCharges >= minimumCharges,
	};
};
