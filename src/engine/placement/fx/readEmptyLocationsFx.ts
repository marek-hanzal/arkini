import { Effect } from "effect";

import { indexGridLocationClaims } from "~/engine/location/read/indexGridLocationClaims";
import { readGridLocationClaimsFx } from "~/engine/location/read/readGridLocationClaimsFx";
import { readGridLocationKey } from "~/engine/location/read/readGridLocationKey";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { readGridItemLocationsFx } from "~/engine/location/read/readGridItemLocationsFx";

export namespace readEmptyLocationsFx {
	export interface Props<Location extends GridLocationSchema.Type> {
		locations: ReadonlyArray<Location>;
		item: ItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Filters concrete locations down to cells with neither an occupant nor a delivery return lease. */
export const readEmptyLocationsFx = Effect.fn("readEmptyLocationsFx")(function* <
	Location extends GridLocationSchema.Type,
>({ item, locations, runtime }: readEmptyLocationsFx.Props<Location>) {
	const claimsByLocation = indexGridLocationClaims(
		yield* readGridLocationClaimsFx({
			runtime,
		}),
	);
	const availableLocationKeys = new Set(locations.map(readGridLocationKey));
	return yield* Effect.filter(locations, (location) =>
		Effect.gen(function* () {
			const occupiedLocations = yield* readGridItemLocationsFx({
				item,
				location,
			});
			return occupiedLocations.every((occupiedLocation) => {
				const key = readGridLocationKey(occupiedLocation);
				return availableLocationKeys.has(key) && !claimsByLocation.has(key);
			});
		}),
	);
});
