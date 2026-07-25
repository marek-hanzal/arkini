import { Array, Effect } from "effect";

import { readGridLocationOccupantsFx } from "~/engine/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readEmptyLocationsFx {
	export interface Props<Location extends GridLocationSchema.Type> {
		locations: ReadonlyArray<Location>;
		runtime: RuntimeSchema.Type;
	}
}

/** Filters concrete locations down to currently unoccupied cells. */
export const readEmptyLocationsFx = Effect.fn("readEmptyLocationsFx")(function* <
	Location extends GridLocationSchema.Type,
>({ locations, runtime }: readEmptyLocationsFx.Props<Location>) {
	const gridItems = Array.getSomes(yield* Effect.forEach(runtime.items, isGridRuntimeItemFx));
	const occupants = yield* readGridLocationOccupantsFx({
		items: gridItems,
		locations,
	});

	return locations.filter((_, index) => occupants[index]?.items.length === 0);
});
