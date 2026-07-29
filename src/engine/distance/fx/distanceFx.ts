import { Effect } from "effect";
import { match } from "ts-pattern";

import { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import { readBoardRectangleChebyshevDistanceFx } from "~/engine/grid/fx/readBoardRectangleChebyshevDistanceFx";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace distanceFx {
	export interface Props {
		distance: DistanceEnumSchema.Type;
		item: BoardRectangleSchema.Type;
		origin: BoardRectangleSchema.Type;
	}
}

/**
 * Tests two coordinates against one Chebyshev distance rule.
 *
 * `close` matches exactly one, `near` exactly two, and `far` every positive
 * distance. The origin itself therefore never matches any distance rule.
 */
export const distanceFx = Effect.fn("distanceFx")(function* ({
	distance,
	item,
	origin,
}: distanceFx.Props) {
	const value = yield* readBoardRectangleChebyshevDistanceFx({
		left: origin,
		right: item,
	});

	return match(distance)
		.with(DistanceEnumSchema.enum.Close, () => {
			return value === 1;
		})
		.with(DistanceEnumSchema.enum.Near, () => {
			return value === 2;
		})
		.with(DistanceEnumSchema.enum.Far, () => {
			return value > 0;
		})
		.exhaustive();
});
