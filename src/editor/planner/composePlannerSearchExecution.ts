import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";

/** Appends one engine-valid subplan to an existing branch-local execution prefix. */
export const composePlannerSearchExecution = (
	prefix: PlannerSearchExecutionState,
	fragment: PlannerSearchExecutionState,
): PlannerSearchExecutionState => ({
	elapsedMs: prefix.elapsedMs + fragment.elapsedMs,
	outputCertainty:
		prefix.outputCertainty === "possible" || fragment.outputCertainty === "possible"
			? "possible"
			: "deterministic",
	runtime: fragment.runtime,
	selectedWitnessProbability:
		prefix.selectedWitnessProbability * fragment.selectedWitnessProbability,
	trace: [
		...prefix.trace,
		...fragment.trace,
	],
});
