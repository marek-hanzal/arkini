/** Aggregated quantity and charge demand for one authored route prerequisite. */
export interface PlannerRequirementDemand {
	charges: number;
	consumed: number;
	retained: number;
	sourcePriority: number;
}
