import { Effect } from "effect";

import type { SpatialRelationFxService } from "~/engine/distance/context/SpatialRelationFx";
import { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";

import { distanceFx } from "./distanceFx";

/**
 * Builds planner geometry that relaxes non-self distance without inventing items.
 *
 * Scope, selector and same-space filtering remain owned by the runtime query. A
 * matching non-origin item may therefore be placed at any authored non-self distance.
 */
export const makeOptimisticSpatialRelationFx = Effect.fn("makeOptimisticSpatialRelationFx")(
	function* () {
		return {
			matches: (props) =>
				props.distance === DistanceEnumSchema.enum.Self
					? distanceFx(props)
					: Effect.succeed(
							props.item.x !== props.origin.x || props.item.y !== props.origin.y,
						),
		} satisfies SpatialRelationFxService;
	},
);
