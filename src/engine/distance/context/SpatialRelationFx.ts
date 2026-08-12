import { Context, type Effect } from "effect";

import { distanceFx } from "~/engine/distance/fx/distanceFx";
import type { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";

export interface SpatialRelationFxService {
	readonly matches: (props: {
		readonly distance: DistanceEnumSchema.Type;
		readonly item: PositionSchema.Type;
		readonly origin: PositionSchema.Type;
	}) => Effect.Effect<boolean>;
}

/** Owns spatial relation semantics over two existing board coordinates. */
export const SpatialRelationFx = Context.Reference<SpatialRelationFxService>("SpatialRelationFx", {
	defaultValue: () => ({
		matches: distanceFx,
	}),
});

export type SpatialRelationFx = typeof SpatialRelationFx;
