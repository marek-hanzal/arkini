import { Effect } from "effect";

import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import type { GridRuntimeItemSchema } from "~/v1/runtime/schema/GridRuntimeItemSchema";

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
	const isSameGridLocation = (left: GridLocationSchema.Type, right: GridLocationSchema.Type) => {
		if (left.scope !== right.scope) return false;
		if (left.scope === "board" && right.scope === "board" && left.space !== right.space) {
			return false;
		}

		return left.position.x === right.position.x && left.position.y === right.position.y;
	};
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
