import { Effect } from "effect";

import { isSameGridLocation } from "~/engine/location/read/isSameGridLocation";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";

export namespace readGridLocationOccupantsFx {
	export interface Props {
		items: ReadonlyArray<GridRuntimeItemSchema.Type>;
		locations: ReadonlyArray<GridLocationSchema.Type>;
	}
}

/** Groups live grid items by one explicit set of concrete board or inventory cells. */
export const readGridLocationOccupantsFx = Effect.fn("readGridLocationOccupantsFx")(function* ({
	items,
	locations,
}: readGridLocationOccupantsFx.Props) {
	const uniqueLocations = locations.filter((location, index) => {
		return (
			locations.findIndex((candidate) => isSameGridLocation(candidate, location)) === index
		);
	});

	return uniqueLocations.map((location) => ({
		location,
		items: items.filter((item) => isSameGridLocation(item.location, location)),
	}));
});
