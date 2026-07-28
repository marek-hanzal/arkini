import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readGridLocationKey } from "./readGridLocationOccupantsFx";

export interface GridLocationClaim {
	readonly itemId: string;
	readonly kind: "delivery-origin" | "occupant";
	readonly location: GridLocationSchema.Type;
}

/**
 * Reads every canonical grid-cell owner, including the return leases implied by deliveries.
 *
 * A delivery origin stays claimed until the same transition either commits the complete item
 * elsewhere or places its returning remainder home. There are no placeholder runtime items.
 */
export const readGridLocationClaimsFx = Effect.fn("readGridLocationClaimsFx")(function* ({
	runtime,
}: {
	readonly runtime: RuntimeSchema.Type;
}) {
	const claims: GridLocationClaim[] = [];
	for (const item of runtime.items) {
		if (
			item.location.scope === LocationScopeEnumSchema.enum.Board ||
			item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
			item.location.scope === LocationScopeEnumSchema.enum.Toolbar
		) {
			claims.push({
				itemId: item.id,
				kind: "occupant",
				location: item.location,
			});
			continue;
		}
		if (item.location.scope === LocationScopeEnumSchema.enum.Delivery) {
			claims.push({
				itemId: item.id,
				kind: "delivery-origin",
				location: item.location.origin,
			});
		}
	}
	return claims;
});

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
