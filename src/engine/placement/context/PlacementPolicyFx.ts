import { Context } from "effect";

import type { planDropPlacementFx } from "~/engine/placement/fx/planDropPlacementFx";
import { planDropPlacementFx as planCanonicalDropPlacementFx } from "~/engine/placement/fx/planDropPlacementFx";
import { readRuntimeItemDropLocationFx } from "~/engine/placement/fx/readRuntimeItemDropLocationFx";

export interface PlacementPolicyFxService {
	readonly planDrop: (props: planDropPlacementFx.Props) => ReturnType<typeof planDropPlacementFx>;
	readonly readItemDropLocation: (
		props: readRuntimeItemDropLocationFx.Props,
	) => ReturnType<typeof readRuntimeItemDropLocationFx>;
}

/** Owns concrete drop placement planning while callers retain atomic application. */
export const PlacementPolicyFx = Context.Reference<PlacementPolicyFxService>("PlacementPolicyFx", {
	defaultValue: () => ({
		planDrop: planCanonicalDropPlacementFx,
		readItemDropLocation: readRuntimeItemDropLocationFx,
	}),
});

export type PlacementPolicyFx = typeof PlacementPolicyFx;
