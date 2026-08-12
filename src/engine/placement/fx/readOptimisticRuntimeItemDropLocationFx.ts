import { Effect } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { readRuntimeItemDropLocationFx } from "~/engine/placement/fx/readRuntimeItemDropLocationFx";
import { readOptimisticScopeLocationsFx } from "~/engine/placement/fx/readOptimisticScopeLocationsFx";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

/** Returns one unbounded planner cell while preserving the existing runtime identity. */
export const readOptimisticRuntimeItemDropLocationFx = Effect.fn(
	"readOptimisticRuntimeItemDropLocationFx",
)(function* ({ item, origin, runtime }: readRuntimeItemDropLocationFx.Props) {
	const scope =
		item.item.scope === StorageScopeEnumSchema.enum.Any
			? LocationScopeEnumSchema.enum.Board
			: item.item.scope;
	const { virtualLocations } = yield* readOptimisticScopeLocationsFx({
		count: 1,
		originSpace: origin.space,
		runtime,
		scope,
	});
	const location = virtualLocations[0];
	if (location === undefined) {
		return yield* Effect.die(new Error("Planner failed to allocate one virtual grid cell."));
	}
	return location;
});
