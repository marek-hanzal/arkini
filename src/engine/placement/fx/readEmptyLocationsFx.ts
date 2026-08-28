import { Effect } from "effect";

import { indexGridLocationClaimsFx } from "~/engine/location/read/indexGridLocationClaimsFx";
import { readGridLocationClaimsFx } from "~/engine/location/read/readGridLocationClaimsFx";
import { readGridLocationKeyFx } from "~/engine/location/read/readGridLocationKeyFx";
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
	const claimsByLocation = yield* indexGridLocationClaimsFx(
		yield* readGridLocationClaimsFx({
			runtime,
		}),
	);
	const empty: Location[] = [];
	for (const location of locations) {
		if (!claimsByLocation.has(yield* readGridLocationKeyFx(location))) empty.push(location);
	}
	return empty;
});
