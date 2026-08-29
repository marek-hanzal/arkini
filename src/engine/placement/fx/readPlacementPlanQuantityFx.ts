import { Effect } from "effect";

import type { PlacementPlan } from "~/engine/placement/PlacementPlan";

export namespace readPlacementPlanQuantityFx {
	export interface Props {
		plan: PlacementPlan;
	}
}

/**
 * Reads the total emitted quantity represented by one placement plan.
 */
export const readPlacementPlanQuantityFx = Effect.fn("readPlacementPlanQuantityFx")(function* ({
	plan,
}: readPlacementPlanQuantityFx.Props) {
	return (
		plan.stack.reduce((quantity, item) => quantity + item.quantity, 0) +
		plan.spawn.reduce((quantity, item) => quantity + item.item.quantity, 0)
	);
});
