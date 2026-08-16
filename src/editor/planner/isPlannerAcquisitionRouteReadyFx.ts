import { Effect } from "effect";

import type { PlannerAcquisitionRoute } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerRequirementDemand } from "~/editor/planner/PlannerRequirementDemand";
import { addPlannerRequirementDemandFx } from "~/editor/planner/addPlannerRequirementDemandFx";
import { readPlannerRuntimeChargeCapacityFx } from "~/editor/planner/readPlannerRuntimeChargeCapacityFx";
import { readPlannerRuntimeQuantityFx } from "~/editor/planner/readPlannerRuntimeQuantityFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const isRequirementReadyFx = Effect.fn("isPlannerAcquisitionRouteReadyFx.requirement")(function* (
	requirement: PlannerAcquisitionRoute["requirements"]["allOf"][number],
	runtime: RuntimeSchema.Type,
) {
	const quantity = yield* readPlannerRuntimeQuantityFx(runtime, requirement.itemId);
	if (quantity < requirement.minimumQuantity) return false;
	if (requirement.usage !== "charge") return true;
	return (
		(yield* readPlannerRuntimeChargeCapacityFx(runtime, requirement.itemId)) >=
		(requirement.chargeCost ?? 0)
	);
});

/** Checks whether one authored route's concrete prerequisite demand is already live. */
export const isPlannerAcquisitionRouteReadyFx = Effect.fn("isPlannerAcquisitionRouteReadyFx")(
	function* (route: PlannerAcquisitionRoute, runtime: RuntimeSchema.Type) {
		const demandByItemId = new Map<IdSchema.Type, PlannerRequirementDemand>();
		for (const requirement of route.requirements.allOf)
			yield* addPlannerRequirementDemandFx(demandByItemId, requirement);
		for (const [itemId, demand] of demandByItemId) {
			const quantity = yield* readPlannerRuntimeQuantityFx(runtime, itemId);
			if (quantity < demand.consumed + demand.retained) return false;
			const charges = yield* readPlannerRuntimeChargeCapacityFx(runtime, itemId);
			if (charges < demand.charges) return false;
		}
		for (const clause of route.requirements.anyOf) {
			let ready = false;
			for (const requirement of clause) {
				if (yield* isRequirementReadyFx(requirement, runtime)) {
					ready = true;
					break;
				}
			}
			if (!ready) return false;
		}
		return true;
	},
);
