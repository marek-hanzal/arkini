import { Effect } from "effect";

import { readGridLocationOccupantsFx } from "~/v1/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
	const occupants = yield* readGridLocationOccupantsFx({
		items: runtime.items.filter(isGridRuntimeItem),
		locations,
	});

	return occupants.filter((entry) => entry.items.length === 0).map((entry) => entry.location);
});
