import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { indexGridLocationClaimsFn } from "~/item-location/fn/indexGridLocationClaimsFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

interface ReadEmptyLocationsProps<Location extends GridLocationSchema.Type> {
	readonly locations: ReadonlyArray<Location>;
	readonly runtime: RuntimeSchema.Type;
	readonly layer: ItemSchema.Type["layer"];
}

/** Filters concrete locations down to cells with neither an occupant nor a delivery return lease. */
export const readEmptyLocationsFn = <Location extends GridLocationSchema.Type>({
	locations,
	layer,
	runtime,
}: ReadEmptyLocationsProps<Location>) => {
	const claimsByLocation = indexGridLocationClaimsFn(
		readGridLocationClaimsFn({
			runtime,
		}),
	);
	const empty: Location[] = [];
	for (const location of locations) {
		if (!claimsByLocation.has(readGridLocationKeyFn(location, layer))) empty.push(location);
	}
	return empty;
};
