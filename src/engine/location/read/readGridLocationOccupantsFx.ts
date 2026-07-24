import { Effect } from "effect";

import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";

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
	const uniqueLocations: GridLocationSchema.Type[] = [];
	for (const location of locations) {
		let duplicate = false;
		for (const candidate of uniqueLocations) {
			if (
				yield* isSameGridLocationFx({
					left: candidate,
					right: location,
				})
			) {
				duplicate = true;
				break;
			}
		}
		if (!duplicate) uniqueLocations.push(location);
	}

	const occupants: {
		readonly location: GridLocationSchema.Type;
		readonly items: GridRuntimeItemSchema.Type[];
	}[] = [];
	for (const location of uniqueLocations) {
		const locationItems: GridRuntimeItemSchema.Type[] = [];
		for (const item of items) {
			if (
				yield* isSameGridLocationFx({
					left: item.location,
					right: location,
				})
			) {
				locationItems.push(item);
			}
		}
		occupants.push({
			location,
			items: locationItems,
		});
	}
	return occupants;
});
