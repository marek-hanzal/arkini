import { Effect } from "effect";

import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerItemGoalStatus } from "~/editor/planner/PlannerItemGoalStatus";
import { readPlannerRuntimeChargeCapacityFx } from "~/editor/planner/readPlannerRuntimeChargeCapacityFx";
import { readPlannerRuntimeQuantityFx } from "~/editor/planner/readPlannerRuntimeQuantityFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Reads the exact quantity and charge state of one item goal in one immutable runtime. */
export const readPlannerItemGoalStatusFx = Effect.fn("readPlannerItemGoalStatusFx")(
	(goal: PlannerItemGoal, runtime: RuntimeSchema.Type) =>
		Effect.gen(function* () {
			const minimumCharges = goal.minimumCharges ?? 0;
			if (!Number.isSafeInteger(goal.quantity) || goal.quantity < 1)
				return yield* Effect.die(
					new RangeError(
						`Planner goal quantity must be a positive safe integer, received ${goal.quantity}.`,
					),
				);
			if (!Number.isSafeInteger(minimumCharges) || minimumCharges < 0)
				return yield* Effect.die(
					new RangeError(
						`Planner goal minimum charges must be a non-negative safe integer, received ${minimumCharges}.`,
					),
				);
			const availableQuantity = yield* readPlannerRuntimeQuantityFx(runtime, goal.itemId);
			const availableCharges = yield* readPlannerRuntimeChargeCapacityFx(
				runtime,
				goal.itemId,
			);
			return {
				availableCharges,
				availableQuantity,
				minimumCharges,
				satisfied: availableQuantity >= goal.quantity && availableCharges >= minimumCharges,
			} satisfies PlannerItemGoalStatus;
		}),
);
