import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { GridLocationClaim } from "./readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "./readGridLocationKeyFn";

/** Reads the first canonical claim at one exact grid cell. */
export const readGridLocationClaimAtFn = ({
	claims,
	location,
}: {
	readonly claims: ReadonlyArray<GridLocationClaim>;
	readonly location: BoardLocationSchema.Type;
}) => {
	const key = readGridLocationKeyFn(location);
	for (const claim of claims) {
		if (readGridLocationKeyFn(claim.location) === key) return claim;
	}
	return undefined;
};
