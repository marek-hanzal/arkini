import { Context } from "effect";

import type { PlannerKernel } from "~/editor/planner/PlannerKernel";

/** Shared immutable planner mechanics for one authored config snapshot. */
export class PlannerKernelFx extends Context.Service<PlannerKernelFx, PlannerKernel>()(
	"PlannerKernelFx",
) {
	//
}
