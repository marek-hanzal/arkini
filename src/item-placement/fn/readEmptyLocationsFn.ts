import { indexGridLocationClaimsFn } from "~/item-location/fn/indexGridLocationClaimsFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "~/item-location/fn/readGridLocationKeyFn";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

interface ReadEmptyLocationsProps<Location extends BoardLocationSchema.Type> {
	readonly locations: ReadonlyArray<Location>;
	readonly runtime: RuntimeSchema.Type;
}

/** Filters concrete locations down to cells with neither an occupant nor a delivery return lease. */
export const readEmptyLocationsFn = <Location extends BoardLocationSchema.Type>({
	locations,
	runtime,
}: ReadEmptyLocationsProps<Location>) => {
	const claimsByLocation = indexGridLocationClaimsFn(
		readGridLocationClaimsFn({
			runtime,
		}),
	);
	const empty: Location[] = [];
	for (const location of locations) {
		if (!claimsByLocation.has(readGridLocationKeyFn(location))) empty.push(location);
	}
	return empty;
};
