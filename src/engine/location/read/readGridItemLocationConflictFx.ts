import { Effect } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { indexGridLocationClaims } from "./indexGridLocationClaims";
import { readGridLocationClaimsFx } from "./readGridLocationClaimsFx";
import { readGridLocationKey } from "./readGridLocationKey";
import { readGridItemLocationsFx } from "./readGridItemLocationsFx";

export namespace readGridItemLocationConflictFx {
	export interface Props {
		excludedItemIds?: ReadonlySet<string>;
		item: ItemSchema.Type;
		location: GridLocationSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Reads the first canonical claim intersecting one candidate item placement. */
export const readGridItemLocationConflictFx = Effect.fn("readGridItemLocationConflictFx")(
	function* ({
		excludedItemIds = new Set(),
		item,
		location,
		runtime,
	}: readGridItemLocationConflictFx.Props) {
		const claimsByLocation = indexGridLocationClaims(
			(yield* readGridLocationClaimsFx({
				runtime,
			})).filter((claim) => !excludedItemIds.has(claim.itemId)),
		);
		const occupiedLocations = yield* readGridItemLocationsFx({
			item,
			location,
		});
		for (const occupiedLocation of occupiedLocations) {
			const claim = claimsByLocation.get(readGridLocationKey(occupiedLocation))?.[0];
			if (claim !== undefined) return claim;
		}
		return undefined;
	},
);
