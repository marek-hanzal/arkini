import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readGridItemLocationsFx } from "./readGridItemLocationsFx";

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
			const locations = yield* readGridItemLocationsFx({
				item: item.item,
				location: item.location,
			});
			for (const location of locations) {
				claims.push({
					itemId: item.id,
					kind: "occupant",
					location,
				});
			}
			continue;
		}
		if (item.location.scope === LocationScopeEnumSchema.enum.Delivery) {
			const locations = yield* readGridItemLocationsFx({
				item: item.item,
				location: item.location.origin,
			});
			for (const location of locations) {
				claims.push({
					itemId: item.id,
					kind: "delivery-origin",
					location,
				});
			}
		}
	}
	return claims;
});
