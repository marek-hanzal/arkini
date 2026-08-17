import { Effect } from "effect";

import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import { readPlannerSearchScopesFx } from "~/editor/planner/readPlannerSearchScopesFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** Reads the locally shortest route plan used by the first engine-backed search pass. */
export const readPlannerSearchScopeFx = Effect.fn("readPlannerSearchScopeFx")(function* ({
	graph,
	targetItemId,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly targetItemId: IdSchema.Type;
}): Effect.fn.Return<PlannerSearchScope> {
	const scope = (yield* readPlannerSearchScopesFx({
		graph,
		maximumScopes: 1,
		targetItemId,
	}))[0];
	if (scope === undefined)
		return yield* Effect.die(
			new Error(`Planner could not build its minimum route scope for ${targetItemId}.`),
		);
	return scope;
});
