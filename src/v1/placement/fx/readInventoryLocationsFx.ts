import { Effect } from "effect";

import type { GridSizeSchema } from "~/v1/grid/schema/GridSizeSchema";
import type { InventoryLocationSchema } from "~/v1/location/schema/InventoryLocationSchema";

export namespace readInventoryLocationsFx {
	export interface Props {
		size: GridSizeSchema.Type;
	}
}

/** Enumerates every universe-wide inventory slot in row-major order. */
export const readInventoryLocationsFx = Effect.fn("readInventoryLocationsFx")(function* ({
	size,
}: readInventoryLocationsFx.Props) {
	const locations: InventoryLocationSchema.Type[] = [];

	for (let y = 0; y < size.height; y += 1) {
		for (let x = 0; x < size.width; x += 1) {
			locations.push({
				scope: "inventory",
				position: {
					x,
					y,
				},
			});
		}
	}

	return locations;
});
