import type { OutputResolutionFxService } from "~/engine/output/context/OutputResolutionFx";
import type { PlannerOutputResolutionTarget } from "~/engine/output/PlannerOutputResolutionTarget";
import { readOutputResolutionSourceId } from "~/engine/output/OutputResolutionSource";
import { resolvePlannerOutputWitnessFx } from "~/engine/output/fx/resolvePlannerOutputWitnessFx";
import { resolveReproducibleOutputFx } from "~/engine/output/fx/resolveReproducibleOutputFx";

/** Builds the planner output policy for either a baseline or one requested witness. */
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
		return resolveReproducibleOutputFx(props);
	},
});
