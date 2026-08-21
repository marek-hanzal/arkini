import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GridLocationClaim } from "./readGridLocationClaimsFx";
import { readGridLocationKeyFx } from "./readGridLocationKeyFx";

/** Reads the first canonical claim at one exact grid cell. */
export const readGridLocationClaimAtFx = Effect.fnUntraced(function* ({
	claims,
	location,
}: {
	readonly claims: ReadonlyArray<GridLocationClaim>;
	readonly location: GridLocationSchema.Type;
}) {
	const key = yield* readGridLocationKeyFx(location);
	for (const claim of claims) {
		if ((yield* readGridLocationKeyFx(claim.location)) === key) return claim;
	}
	return undefined;
});
