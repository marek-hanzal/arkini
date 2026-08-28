import { Effect } from "effect";

import type { GridLocationClaim } from "./readGridLocationClaimsFx";
import { readGridLocationKeyFx } from "./readGridLocationKeyFx";

/** Groups canonical occupants and delivery-origin leases by concrete grid cell. */
export const indexGridLocationClaimsFx = Effect.fnUntraced(function* (
	claims: ReadonlyArray<GridLocationClaim>,
) {
	const claimsByLocation = new Map<string, GridLocationClaim[]>();
	for (const claim of claims) {
		const key = yield* readGridLocationKeyFx(claim.location);
		const existing = claimsByLocation.get(key);
		if (existing === undefined) {
			claimsByLocation.set(key, [
				claim,
			]);
		} else {
			existing.push(claim);
		}
	}
	return claimsByLocation;
});
