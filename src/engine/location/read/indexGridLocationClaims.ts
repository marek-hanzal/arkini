import { readGridLocationKey } from "./readGridLocationKey";
import type { GridLocationClaim } from "./readGridLocationClaimsFx";

/** Groups canonical occupants and delivery-origin leases by concrete grid cell. */
export const indexGridLocationClaims = (claims: ReadonlyArray<GridLocationClaim>) => {
	const claimsByLocation = new Map<string, GridLocationClaim[]>();
	for (const claim of claims) {
		const key = readGridLocationKey(claim.location);
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
