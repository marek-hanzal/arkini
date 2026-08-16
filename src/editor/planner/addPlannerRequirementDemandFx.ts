import { Effect } from "effect";

import type { PlannerAcquisitionRequirement } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerRequirementDemand } from "~/editor/planner/PlannerRequirementDemand";
import { readPlannerRequirementSourcePriorityFx } from "~/editor/planner/readPlannerRequirementSourcePriorityFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** Adds one authored prerequisite to one mutable branch-local demand accumulator. */
export const addPlannerRequirementDemandFx = Effect.fn("addPlannerRequirementDemandFx")(function* (
	demandByItemId: Map<IdSchema.Type, PlannerRequirementDemand>,
	requirement: PlannerAcquisitionRequirement,
) {
	const sourcePriority = yield* readPlannerRequirementSourcePriorityFx(requirement.source);
	const demand = demandByItemId.get(requirement.itemId) ?? {
		charges: 0,
		consumed: 0,
		retained: 0,
		sourcePriority,
	};
	if (requirement.usage === "consume") demand.consumed += requirement.minimumQuantity;
	else demand.retained = Math.max(demand.retained, requirement.minimumQuantity);
	if (requirement.usage === "charge") demand.charges += requirement.chargeCost ?? 0;
	demand.sourcePriority = Math.min(demand.sourcePriority, sourcePriority);
	demandByItemId.set(requirement.itemId, demand);
});
