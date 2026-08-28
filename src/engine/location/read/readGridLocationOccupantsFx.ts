import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import { readGridLocationKeyFx } from "./readGridLocationKeyFx";

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
		const key = yield* readGridLocationKeyFx(item.location);
		const occupants = itemsByLocation.get(key);
		if (occupants === undefined) {
			itemsByLocation.set(key, [
				item,
			]);
		} else {
			occupants.push(item);
		}
	}

	const occupants: {
		readonly location: GridLocationSchema.Type;
		readonly items: GridRuntimeItemSchema.Type[];
	}[] = [];
	const seenLocations = new Set<string>();
	for (const location of locations) {
		const key = yield* readGridLocationKeyFx(location);
		if (seenLocations.has(key)) continue;
		seenLocations.add(key);
		occupants.push({
			location,
			items: itemsByLocation.get(key) ?? [],
		});
	}
	return occupants;
});
