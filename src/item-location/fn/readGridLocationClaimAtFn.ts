import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { GridLocationClaim } from "./readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "./readGridLocationKeyFn";

/** Reads the first canonical claim at one exact grid cell. */
export const readGridLocationClaimAtFn = ({
	claims,
	location,
}: {
	readonly claims: ReadonlyArray<GridLocationClaim>;
	readonly location: GridLocationSchema.Type;
}) => {
	const key = readGridLocationKeyFn(location);
	for (const claim of claims) {
		if (readGridLocationKeyFn(claim.location) === key) return claim;
	}
	return undefined;
};
