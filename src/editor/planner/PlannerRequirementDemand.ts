import type { PlannerAcquisitionRequirement } from "~/editor/planner/PlannerAcquisitionGraph";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** Aggregated quantity and charge demand for one authored route prerequisite. */
export interface PlannerRequirementDemand {
	charges: number;
	consumed: number;
	retained: number;
	sourcePriority: number;
}

export const readPlannerRequirementSourcePriority = (
	source: PlannerAcquisitionRequirement["source"],
) => {
	switch (source) {
		case "owner":
		case "merge-source":
		case "merge-target":
			return 0;
		case "charged-item":
		case "temporary-item":
			return 1;
		case "deposit-input":
		case "material-input":
			return 2;
		case "line-condition":
		case "output-condition":
			return 3;
	}
};

export const addPlannerRequirementDemand = (
	demandByItemId: Map<IdSchema.Type, PlannerRequirementDemand>,
	requirement: PlannerAcquisitionRequirement,
) => {
	const sourcePriority = readPlannerRequirementSourcePriority(requirement.source);
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
};
