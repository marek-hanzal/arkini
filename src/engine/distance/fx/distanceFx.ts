import { Effect } from "effect";
import { match } from "ts-pattern";

import { DistanceSchema } from "~/engine/distance/schema/DistanceSchema";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";

export namespace distanceFx {
	export interface Props {
		distance: DistanceSchema.Type;
		item: PositionSchema.Type;
		origin: PositionSchema.Type;
	}
}

/**
 * Tests two coordinates against one Chebyshev distance rule.
 *
 * `self` matches zero, `close` exactly one, `near` exactly two, and `far`
 * every positive distance.
 */
export const distanceFx = Effect.fn("distanceFx")(function* ({
	distance,
	item,
	origin,
}: distanceFx.Props) {
	const width = Math.abs(item.x - origin.x);
	const height = Math.abs(item.y - origin.y);
	const value = Math.max(width, height);

	return match(distance)
		.with(DistanceSchema.enum.Self, () => {
			return value === 0;
		})
		.with(DistanceSchema.enum.Close, () => {
			return value === 1;
		})
		.with(DistanceSchema.enum.Near, () => {
			return value === 2;
		})
		.with(DistanceSchema.enum.Far, () => {
			return value > 0;
		})
		.exhaustive();
});
