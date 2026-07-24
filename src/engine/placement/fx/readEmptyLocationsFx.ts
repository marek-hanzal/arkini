import { Array, Effect } from "effect";

import { readGridLocationOccupantsFx } from "~/engine/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
	const gridItems = Array.getSomes(yield* Effect.forEach(runtime.items, isGridRuntimeItemFx));
	const occupants = yield* readGridLocationOccupantsFx({
		items: gridItems,
		locations,
	});

	return occupants.filter((entry) => entry.items.length === 0).map((entry) => entry.location);
});
