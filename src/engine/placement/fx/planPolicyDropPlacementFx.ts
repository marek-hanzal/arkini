import { Effect } from "effect";

import { PlacementPolicyFx } from "~/engine/placement/context/PlacementPolicyFx";
import type { planDropPlacementFx } from "~/engine/placement/fx/planDropPlacementFx";

/** Plans one concrete drop through the placement policy in the current Effect context. */
export const planPolicyDropPlacementFx = Effect.fn("planPolicyDropPlacementFx")(function* (
	props: planDropPlacementFx.Props,
) {
	return yield* (yield* PlacementPolicyFx).planDrop(props);
});
