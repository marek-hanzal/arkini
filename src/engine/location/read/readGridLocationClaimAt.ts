import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

import type { GridLocationClaim } from "./readGridLocationClaimsFx";
import { readGridLocationKey } from "./readGridLocationKey";

/** Reads the first canonical claim at one exact grid cell. */
export const readGridLocationClaimAt = ({
	claims,
	location,
}: {
	readonly claims: ReadonlyArray<GridLocationClaim>;
	readonly location: GridLocationSchema.Type;
}) => {
	const key = readGridLocationKey(location);
	return claims.find((claim) => readGridLocationKey(claim.location) === key);
};
