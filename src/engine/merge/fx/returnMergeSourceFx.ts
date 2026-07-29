import { Effect } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import { applyPlacementPlanFx } from "~/engine/placement/fx/applyPlacementPlanFx";
import { planDropPlacementFx } from "~/engine/placement/fx/planDropPlacementFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace returnMergeSourceFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		originRectangle?: BoardRectangleSchema.Type;
		returnDrop?: DropResultSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns one detached `use` source quantity through standard drop placement. */
export const returnMergeSourceFx = Effect.fn("returnMergeSourceFx")(function* ({
	origin,
	originRectangle,
	returnDrop,
	runtime,
}: returnMergeSourceFx.Props) {
	if (returnDrop === undefined) return runtime;

	const plan = yield* planDropPlacementFx({
		drop: returnDrop,
		origin,
		originRectangle,
		runtime,
	});
	const [, nextRuntime] = yield* applyPlacementPlanFx({
		plan,
		runtime,
	});
	return nextRuntime;
});
