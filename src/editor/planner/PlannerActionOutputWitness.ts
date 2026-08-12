import type { PlannerAcquisitionOutputStatistics } from "~/editor/planner/PlannerAcquisitionGraph";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { OutputResolutionSource } from "~/engine/output/OutputResolutionSource";
import type { OutputSelectionWitness } from "~/engine/output/OutputSelectionWitness";

/** One route-specific output branch requested while executing an authored action. */
export interface PlannerActionOutputWitness {
	readonly outputItemId: IdSchema.Type;
	readonly routeId: string;
	readonly source: OutputResolutionSource;
	readonly statistics: PlannerAcquisitionOutputStatistics;
	readonly witness: OutputSelectionWitness;
	readonly witnessId: string;
}
