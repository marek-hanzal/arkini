import type { OutputResolutionFxService } from "~/engine/output/context/OutputResolutionFx";
import type { PlannerOutputResolutionTarget } from "~/engine/output/PlannerOutputResolutionTarget";
import { readOutputResolutionSourceId } from "~/engine/output/OutputResolutionSource";
import { resolvePlannerOutputWitnessFx } from "~/engine/output/fx/resolvePlannerOutputWitnessFx";
import { resolvePlannerGuaranteedOutputFx } from "~/engine/output/fx/resolvePlannerGuaranteedOutputFx";

/** Builds the planner output policy for either the guaranteed floor or one requested witness. */
export const makePlannerOutputResolutionFx = (
	target?: PlannerOutputResolutionTarget,
): OutputResolutionFxService => ({
	resolve: (props) => {
		if (
			target !== undefined &&
			props.source !== undefined &&
			readOutputResolutionSourceId(props.source) ===
				readOutputResolutionSourceId(target.source)
		) {
			target.onResolved?.();
			return resolvePlannerOutputWitnessFx({
				origin: props.origin,
				output: props.output,
				witness: target.witness,
			});
		}
		return resolvePlannerGuaranteedOutputFx(props);
	},
});
