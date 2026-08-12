import type { OutputResolutionSource } from "~/engine/output/OutputResolutionSource";
import type { OutputSelectionWitness } from "~/engine/output/OutputSelectionWitness";

/** Output request whose stochastic branch the planner must realize existentially. */
export interface PlannerOutputResolutionTarget {
	readonly onResolved?: () => void;
	readonly source: OutputResolutionSource;
	readonly witness: OutputSelectionWitness;
}
