import { Effect } from "effect";

import type { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

export namespace readBoardLocationsFx {
	export interface Props {
		size: GridSizeSchema.Type;
		space: NonNegativeIntegerSchema.Type;
	}
}

/** Enumerates every concrete cell in one board space in row-major order. */
export const readBoardLocationsFx = Effect.fn("readBoardLocationsFx")(function* ({
	size,
	space,
}: readBoardLocationsFx.Props) {
	const locations: BoardLocationSchema.Type[] = [];

	for (let y = 0; y < size.height; y += 1) {
		for (let x = 0; x < size.width; x += 1) {
			locations.push({
				scope: "board",
				space,
				position: {
					x,
					y,
				},
			});
		}
	}

	return locations;
});
