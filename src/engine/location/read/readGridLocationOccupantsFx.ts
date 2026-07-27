import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";

export namespace readGridLocationOccupantsFx {
	export interface Props {
		items: ReadonlyArray<GridRuntimeItemSchema.Type>;
		locations: ReadonlyArray<GridLocationSchema.Type>;
	}
}

const readGridLocationKey = (location: GridLocationSchema.Type) => {
	const position = `${location.position.x}:${location.position.y}`;
	return location.scope === LocationScopeEnumSchema.enum.Board
		? `${location.scope}:${location.space}:${position}`
		: `${location.scope}:${position}`;
};

/** Groups live grid items by one explicit set of concrete board, inventory, or toolbar cells. */
export const readGridLocationOccupantsFx = Effect.fn("readGridLocationOccupantsFx")(function* ({
	items,
	locations,
}: readGridLocationOccupantsFx.Props) {
	const itemsByLocation = new Map<string, GridRuntimeItemSchema.Type[]>();
	for (const item of items) {
		const key = readGridLocationKey(item.location);
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
