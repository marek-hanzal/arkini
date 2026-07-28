import { Effect } from "effect";

import {
	indexGridLocationClaims,
	readGridLocationClaimsFx,
} from "~/engine/location/read/readGridLocationClaimsFx";
import { readGridLocationKey } from "~/engine/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readEmptyLocationsFx {
	export interface Props<Location extends GridLocationSchema.Type> {
		locations: ReadonlyArray<Location>;
		runtime: RuntimeSchema.Type;
	}
}

/** Filters concrete locations down to cells with neither an occupant nor a delivery return lease. */
export const readEmptyLocationsFx = Effect.fn("readEmptyLocationsFx")(function* <
	Location extends GridLocationSchema.Type,
>({ locations, runtime }: readEmptyLocationsFx.Props<Location>) {
	const claimsByLocation = indexGridLocationClaims(
		yield* readGridLocationClaimsFx({
			runtime,
		}),
	);
	return locations.filter((location) => !claimsByLocation.has(readGridLocationKey(location)));
});
