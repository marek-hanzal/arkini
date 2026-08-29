import { indexGridLocationClaimsFn } from "~/engine/location/fn/indexGridLocationClaimsFn";
import { readGridLocationClaimsFn } from "~/engine/location/fn/readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "~/engine/location/fn/readGridLocationKeyFn";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readEmptyLocationsFn {
	export interface Props<Location extends GridLocationSchema.Type> {
		locations: ReadonlyArray<Location>;
		runtime: RuntimeSchema.Type;
	}
}

/** Filters concrete locations down to cells with neither an occupant nor a delivery return lease. */
export const readEmptyLocationsFn = <Location extends GridLocationSchema.Type>({
	locations,
	runtime,
}: readEmptyLocationsFn.Props<Location>) => {
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
