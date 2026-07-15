import { Effect } from "effect";

import { isSameGridLocation } from "~/v1/location/read/isSameGridLocation";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";

export namespace readEmptyLocationsFx {
	export interface Props {
		locations: ReadonlyArray<GridLocationSchema.Type>;
		runtime: RuntimeSchema.Type;
	}
}

/** Filters concrete locations down to currently unoccupied cells. */
export const readEmptyLocationsFx = Effect.fn("readEmptyLocationsFx")(function* ({
	locations,
	runtime,
}: readEmptyLocationsFx.Props) {
	const gridItems = runtime.items.filter(isGridRuntimeItem);
	return locations.filter(
		(location) => !gridItems.some((item) => isSameGridLocation(item.location, location)),
	);
});
