import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import { readGridItemLocationsFx } from "./readGridItemLocationsFx";
import { readGridLocationKey } from "./readGridLocationKey";

export namespace readGridLocationOccupantsFx {
	export interface Props {
		items: ReadonlyArray<GridRuntimeItemSchema.Type>;
		locations: ReadonlyArray<GridLocationSchema.Type>;
	}
}

/** Groups live grid items by one explicit set of concrete board, inventory, or toolbar cells. */
export const readGridLocationOccupantsFx = Effect.fn("readGridLocationOccupantsFx")(function* ({
	items,
	locations,
}: readGridLocationOccupantsFx.Props) {
	const itemsByLocation = new Map<string, GridRuntimeItemSchema.Type[]>();
	for (const item of items) {
		const occupiedLocations = yield* readGridItemLocationsFx({
			item: item.item,
			location: item.location,
		});
		for (const occupiedLocation of occupiedLocations) {
			const key = readGridLocationKey(occupiedLocation);
			const occupants = itemsByLocation.get(key);
			if (occupants === undefined) {
				itemsByLocation.set(key, [
					item,
				]);
			} else if (!occupants.some((occupant) => occupant.id === item.id)) {
				occupants.push(item);
			}
		}
	}

	const occupants: {
		readonly location: GridLocationSchema.Type;
		readonly items: GridRuntimeItemSchema.Type[];
	}[] = [];
	const seenLocations = new Set<string>();
	for (const location of locations) {
		const key = readGridLocationKey(location);
		if (seenLocations.has(key)) continue;
		seenLocations.add(key);
		occupants.push({
			location,
			items: itemsByLocation.get(key) ?? [],
		});
	}
	return occupants;
});
