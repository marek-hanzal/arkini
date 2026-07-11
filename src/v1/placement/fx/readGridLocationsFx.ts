import { Effect } from "effect";

import type { GridSizeSchema } from "~/v1/grid/schema/GridSizeSchema";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";

export namespace readGridLocationsFx {
	export interface Props {
		scope: GridLocationSchema.Type["scope"];
		size: GridSizeSchema.Type;
	}
}

/**
 * Enumerates every concrete grid location in row-major scan order.
 */
export const readGridLocationsFx = Effect.fn("readGridLocationsFx")(function* ({
	scope,
	size,
}: readGridLocationsFx.Props) {
	const locations: GridLocationSchema.Type[] = [];

	for (let y = 0; y < size.height; y += 1) {
		for (let x = 0; x < size.width; x += 1) {
			locations.push({
				position: {
					x,
					y,
				},
				scope,
			});
		}
	}

	return locations;
});
