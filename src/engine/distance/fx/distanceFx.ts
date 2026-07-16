import { Effect } from "effect";
import { match } from "ts-pattern";

import type { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import type { PositionSchema } from "~/engine/grid/schema/PositionSchema";

export namespace distanceFx {
	export interface Props {
		distance: DistanceEnumSchema.Type;
		item: PositionSchema.Type;
		origin: PositionSchema.Type;
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
	const width = Math.abs(item.x - origin.x);
	const height = Math.abs(item.y - origin.y);
	const value = Math.max(width, height);

	return match(distance)
		.with("close", () => {
			return value === 1;
		})
		.with("near", () => {
			return value === 2;
		})
		.with("far", () => {
			return value > 0;
		})
		.exhaustive();
});
