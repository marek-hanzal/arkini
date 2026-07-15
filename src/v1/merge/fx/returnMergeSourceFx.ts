import { Effect } from "effect";

import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { planDropPlacementFx } from "~/v1/placement/fx/planDropPlacementFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace returnMergeSourceFx {
	export interface Props {
		origin: PositionSchema.Type;
		returnDrop?: DropResultSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns one detached `use` source quantity through standard drop placement. */
export const returnMergeSourceFx = Effect.fn("returnMergeSourceFx")(function* ({
	origin,
	returnDrop,
	runtime,
}: returnMergeSourceFx.Props) {
	if (returnDrop === undefined) return runtime;

	const plan = yield* planDropPlacementFx({
		drop: returnDrop,
		origin,
		runtime,
	});
	const [, nextRuntime] = yield* applyPlacementPlanFx({
		plan,
		runtime,
	});
	return nextRuntime;
});
