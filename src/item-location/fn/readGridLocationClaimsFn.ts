import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
export const readGridLocationClaimsFn = ({ runtime }: { readonly runtime: RuntimeSchema.Type }) => {
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
};
