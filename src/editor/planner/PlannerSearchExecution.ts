import type {
	PlannerSearchOutputCertainty,
	PlannerSearchTraceEntry,
} from "~/editor/planner/PlannerSearch";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Shared immutable execution state advanced only through canonical planner engine actions. */
export interface PlannerSearchExecutionState {
	readonly elapsedMs: number;
	readonly outputCertainty: PlannerSearchOutputCertainty;
	readonly runtime: RuntimeSchema.Type;
	readonly selectedWitnessProbability: number;
	readonly trace: ReadonlyArray<PlannerSearchTraceEntry>;
}
