import {
	DefaultPlannerSearchBudget,
	type PlannerSearchBudget,
} from "~/editor/planner/PlannerSearch";

const readPositiveBudget = (candidate: number | undefined, fallback: number) =>
	candidate === undefined || !Number.isFinite(candidate)
		? fallback
		: Math.max(1, Math.floor(candidate));

/** Normalizes a partial planner budget into finite positive integer limits. */
export const readPlannerSearchBudget = (
	budget?: Partial<PlannerSearchBudget>,
): PlannerSearchBudget => ({
	maximumExpandedStates: readPositiveBudget(
		budget?.maximumExpandedStates,
		DefaultPlannerSearchBudget.maximumExpandedStates,
	),
	maximumQueuedStates: readPositiveBudget(
		budget?.maximumQueuedStates,
		DefaultPlannerSearchBudget.maximumQueuedStates,
	),
	maximumRoutePlans: readPositiveBudget(
		budget?.maximumRoutePlans,
		DefaultPlannerSearchBudget.maximumRoutePlans,
	),
	maximumTraceLength: readPositiveBudget(
		budget?.maximumTraceLength,
		DefaultPlannerSearchBudget.maximumTraceLength,
	),
});
