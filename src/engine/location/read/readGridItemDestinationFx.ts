import { Effect } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { indexGridLocationClaims } from "./indexGridLocationClaims";
import { readGridLocationClaimsFx, type GridLocationClaim } from "./readGridLocationClaimsFx";
import { readGridLocationKey } from "./readGridLocationKey";
import { readGridItemLocationsFx } from "./readGridItemLocationsFx";

export namespace readGridItemDestinationFx {
	export interface Props {
		excludedItemIds?: ReadonlySet<string>;
		item: ItemSchema.Type;
		location: GridLocationSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves the concrete cells and ordered distinct claims for one candidate item destination. */
export const readGridItemDestinationFx = Effect.fn("readGridItemDestinationFx")(function* ({
	excludedItemIds = new Set(),
	item,
	location,
	runtime,
}: readGridItemDestinationFx.Props) {
	const locations = yield* readGridItemLocationsFx({
		item,
		location,
	});
	const claimsByLocation = indexGridLocationClaims(
		(yield* readGridLocationClaimsFx({
			runtime,
		})).filter((claim) => !excludedItemIds.has(claim.itemId)),
	);
	const claims: GridLocationClaim[] = [];
	const seenClaims = new Set<string>();
	for (const occupiedLocation of locations) {
		for (const claim of claimsByLocation.get(readGridLocationKey(occupiedLocation)) ?? []) {
			const key = `${claim.kind}:${claim.itemId}`;
			if (seenClaims.has(key)) continue;
			seenClaims.add(key);
			claims.push(claim);
		}
	}
	return {
		claims,
		locations,
	};
});
