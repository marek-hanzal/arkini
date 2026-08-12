import { Effect } from "effect";

import { PlacementPolicyFx } from "~/engine/placement/context/PlacementPolicyFx";
import type { readRuntimeItemDropLocationFx } from "~/engine/placement/fx/readRuntimeItemDropLocationFx";

/** Resolves one existing identity's drop cell through the current placement policy. */
export const readPolicyRuntimeItemDropLocationFx = Effect.fn("readPolicyRuntimeItemDropLocationFx")(
	function* (props: readRuntimeItemDropLocationFx.Props) {
		return yield* (yield* PlacementPolicyFx).readItemDropLocation(props);
	},
);
