import type { EstimateRequirementGroup } from "~/estimate-demand/fn/groupEstimateRequirementsFn";
import type { EditorAcquisitionRoute } from "~/flow/type/EditorAcquisitionGraph";

/** One immutable quantity-specific route witness sealed after all dependency children. */
export interface EstimateWitnessNode {
	readonly actionRuns: number;
	readonly children: ReadonlyArray<{
		readonly group: EstimateRequirementGroup;
		readonly node: EstimateWitnessNode;
	}>;
	readonly durationMs: number;
	readonly factId: string;
	readonly outputRuns: number;
	readonly quantity: number;
	readonly rootQuantity: number;
	readonly route?: EditorAcquisitionRoute;
}
