import { Effect } from "effect";

import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readBoardRectangleLocationsFx {
	export interface Props {
		rectangle: BoardRectangleSchema.Type;
	}
}

/** Enumerates the occupied cells of one Board rectangle in deterministic row-major order. */
export const readBoardRectangleLocationsFx = Effect.fn("readBoardRectangleLocationsFx")(function* ({
	rectangle,
}: readBoardRectangleLocationsFx.Props) {
	const locations: BoardLocationSchema.Type[] = [];

	for (let y = rectangle.anchor.y; y < rectangle.anchor.y + rectangle.footprint.height; y += 1) {
		for (
			let x = rectangle.anchor.x;
			x < rectangle.anchor.x + rectangle.footprint.width;
			x += 1
		) {
			locations.push({
				scope: LocationScopeEnumSchema.enum.Board,
				space: rectangle.space,
				position: {
					x,
					y,
				},
			});
		}
	}

	return locations;
});
