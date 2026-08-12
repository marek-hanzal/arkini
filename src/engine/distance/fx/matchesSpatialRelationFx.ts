import { Effect } from "effect";

import { SpatialRelationFx } from "~/engine/distance/context/SpatialRelationFx";
import type { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";

export namespace matchesSpatialRelationFx {
	export interface Props {
		readonly distance: DistanceEnumSchema.Type;
		readonly item: PositionSchema.Type;
		readonly origin: PositionSchema.Type;
	}
}

/** Tests one relation through the policy provided by the current Effect context. */
export const matchesSpatialRelationFx = Effect.fn("matchesSpatialRelationFx")(function* (
	props: matchesSpatialRelationFx.Props,
) {
	return yield* (yield* SpatialRelationFx).matches(props);
});
