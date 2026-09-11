import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { GridLocationClaim } from "./readGridLocationClaimsFn";
import { readGridLocationKeyFn } from "./readGridLocationKeyFn";

/** Reads the first canonical claim at one exact grid cell. */
export const readGridLocationClaimAtFn = ({
	claims,
	location,
	layer,
}: {
	readonly claims: ReadonlyArray<GridLocationClaim>;
	readonly location: GridLocationSchema.Type;
	readonly layer: ItemSchema.Type["layer"];
}) => {
	const key = readGridLocationKeyFn(location, layer);
	for (const claim of claims) {
		if (readGridLocationKeyFn(claim.location, claim.layer) === key) return claim;
	}
	return undefined;
};
