import type { GridLocationClaim } from "./readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "./readGridLocationKeyFn";

/** Groups canonical occupants and delivery-origin leases by concrete grid cell. */
export const indexGridLocationClaimsFn = (claims: ReadonlyArray<GridLocationClaim>) => {
	const claimsByLocation = new Map<string, GridLocationClaim[]>();
	for (const claim of claims) {
		const key = readGridLocationKeyFn(claim.location);
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
};
